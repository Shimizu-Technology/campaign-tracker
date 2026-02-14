# frozen_string_literal: true

module Api
  module V1
    class SettingsController < ApplicationController
      include Authenticatable
      before_action :authenticate_request
      before_action :require_admin!

      # GET /api/v1/settings
      def show
        campaign = Campaign.active.first
        unless campaign
          return render_api_error(message: "No active campaign", status: :not_found, code: "no_campaign")
        end

        render json: {
          welcome_sms_template: campaign.welcome_sms_template || SmsService::DEFAULT_WELCOME_TEMPLATE,
          welcome_sms_preview: SmsService.preview_welcome_template(campaign.welcome_sms_template),
          available_variables: SmsService::WELCOME_TEMPLATE_VARIABLES
        }
      end

      # PATCH /api/v1/settings
      def update
        campaign = Campaign.active.first
        unless campaign
          return render_api_error(message: "No active campaign", status: :not_found, code: "no_campaign")
        end

        template = params[:welcome_sms_template]

        if template.present? && template.length > 320
          return render_api_error(
            message: "Template too long (#{template.length} chars). Maximum is 320 characters (2 SMS segments).",
            status: :unprocessable_entity,
            code: "template_too_long"
          )
        end

        # Allow blank to reset to default
        campaign.update!(welcome_sms_template: template.presence)

        render json: {
          welcome_sms_template: campaign.welcome_sms_template || SmsService::DEFAULT_WELCOME_TEMPLATE,
          welcome_sms_preview: SmsService.preview_welcome_template(campaign.welcome_sms_template),
          available_variables: SmsService::WELCOME_TEMPLATE_VARIABLES
        }
      end

      private

      def require_admin!
        unless current_user&.role == "campaign_admin"
          render_api_error(message: "Admin access required", status: :forbidden, code: "forbidden")
        end
      end
    end
  end
end
