# frozen_string_literal: true

module Api
  module V1
    class ReportsController < ApplicationController
      include Authenticatable
      include AuditLoggable
      before_action :authenticate_request
      before_action :require_coordinator_or_above!

      # GET /api/v1/reports/:report_type
      # Generate and download an Excel report.
      # Params:
      #   report_type: support_list | purge_list | transfer_list | referral_list | quota_summary
      #   village_id (optional): filter to a specific village
      def show
        report_type = params[:report_type]

        unless ReportGenerator::REPORT_TYPES.include?(report_type)
          return render_api_error(
            message: "Unknown report type: #{report_type}. Valid types: #{ReportGenerator::REPORT_TYPES.join(', ')}",
            status: :unprocessable_entity,
            code: "invalid_report_type"
          )
        end

        generator = ReportGenerator.new(
          report_type: report_type,
          village_id: params[:village_id],
          campaign_id: params[:campaign_id]
        )

        begin
          result = generator.generate
        rescue => e
          return render_api_error(
            message: "Report generation failed: #{e.message}",
            status: :internal_server_error,
            code: "report_generation_failed"
          )
        end

        log_audit!(nil, action: "report_generated", changed_data: {
          "report_type" => report_type,
          "village_id" => params[:village_id],
          "filename" => result[:filename]
        })

        send_data result[:package].to_stream.read,
          filename: result[:filename],
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          disposition: "attachment"
      end

      # GET /api/v1/reports
      # List available report types with current counts
      def index
        latest_gec = GecVoter.maximum(:gec_list_date)

        render json: {
          available_reports: ReportGenerator::REPORT_TYPES.map do |rt|
            {
              type: rt,
              name: rt.humanize.titleize,
              description: report_description(rt)
            }
          end,
          latest_gec_list_date: latest_gec,
          gec_data_loaded: GecVoter.active.any?,
          quick_stats: {
            quota_eligible: Supporter.active.quota_eligible.count,
            total_verified: Supporter.active.verified.count,
            total_active: Supporter.active.count,
            public_signups: Supporter.active.public_signups.count,
            unregistered: Supporter.active.where(registered_voter: false).count,
            transfers: Supporter.active.where.not(referred_from_village_id: nil).count,
            purged_voters: GecVoter.where(status: "removed").count
          }
        }
      end

      private

      def report_description(type)
        case type
        when "support_list"
          "All verified team-input supporters by village (quota-eligible)"
        when "purge_list"
          "Voters removed from GEC list (deceased or purged)"
        when "transfer_list"
          "Supporters who are registered in a different village than submitted"
        when "referral_list"
          "Supporters routed to correct village based on GEC registration"
        when "quota_summary"
          "Per-village quota progress with totals and status"
        end
      end
    end
  end
end
