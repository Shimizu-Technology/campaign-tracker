# frozen_string_literal: true

module Api
  module V1
    class SmsController < ApplicationController
      include Authenticatable
      before_action :authenticate_request
      before_action :require_coordinator_or_above!, only: [ :send_single, :blast, :event_notify ]

      # GET /api/v1/sms/status
      # Check ClickSend account status + balance
      def status
        balance = SmsService.balance
        render json: {
          configured: ENV["CLICKSEND_USERNAME"].present? && ENV["CLICKSEND_API_KEY"].present?,
          balance: balance,
          sender_id: ENV["CLICKSEND_SENDER_ID"] || "JT2026"
        }
      end

      # POST /api/v1/sms/send
      # Send a single SMS (for testing)
      def send_single
        phone = params[:phone]
        message = params[:message]

        if phone.blank? || message.blank?
          return render_api_error(
            message: "Phone and message required",
            status: :unprocessable_entity,
            code: "sms_phone_and_message_required"
          )
        end

        result = ClicksendClient.send_sms(to: phone, body: message)
        render json: result
      end

      # POST /api/v1/sms/blast
      # Send SMS to filtered supporters
      def blast
        message = params[:message]
        if message.blank?
          return render_api_error(
            message: "Message is required",
            status: :unprocessable_entity,
            code: "sms_message_required"
          )
        end

        supporters = Supporter.active.where.not(contact_number: [ nil, "" ])

        # Optional filters
        supporters = supporters.where(village_id: params[:village_id]) if params[:village_id].present?
        supporters = supporters.where(motorcade_available: true) if params[:motorcade_available] == "true"
        supporters = supporters.where(registered_voter: true) if params[:registered_voter] == "true"
        supporters = supporters.where(yard_sign: true) if params[:yard_sign] == "true"

        count = supporters.count

        if params[:dry_run] == "true"
          return render json: { dry_run: true, recipient_count: count, message: message }
        end

        filters = {
          "village_id" => params[:village_id],
          "motorcade_available" => params[:motorcade_available],
          "registered_voter" => params[:registered_voter],
          "yard_sign" => params[:yard_sign]
        }
        SmsBlastJob.perform_later(message: message, filters: filters)

        render json: {
          queued: true,
          total_targeted: count,
          message: "SMS blast queued successfully"
        }, status: :accepted
      end

      # POST /api/v1/sms/event_notify
      # Notify supporters about an event
      def event_notify
        event = Event.find(params[:event_id])
        notification_type = params[:type] || "rsvp"

        rsvps = event.event_rsvps.includes(:supporter)
        rsvps = rsvps.where(rsvp_status: "confirmed") if notification_type == "reminder"

        EventNotifyJob.perform_later(event_id: event.id, notification_type: notification_type)

        render json: {
          queued: true,
          event: event.name,
          type: notification_type,
          total_targeted: rsvps.size
        }, status: :accepted
      end
    end
  end
end
