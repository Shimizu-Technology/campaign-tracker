# frozen_string_literal: true

module Api
  module V1
    class ScanController < ApplicationController
      include Authenticatable
      before_action :authenticate_request
      before_action :require_staff_entry_access!

      # POST /api/v1/scan
      # Accepts a base64 image and returns extracted form data
      def create
        image_data = params[:image]

        if image_data.blank?
          return render_api_error(
            message: "Image data is required",
            status: :unprocessable_entity,
            code: "image_data_required"
          )
        end

        result = FormScanner.extract(image_data)

        if result[:success]
          render json: {
            success: true,
            extracted: result[:data],
            message: "Form data extracted successfully"
          }
        else
          render json: {
            success: false,
            error: result[:error],
            code: "scan_extraction_failed",
            raw_response: result[:raw_response]
          }, status: :unprocessable_entity
        end
      end
    end
  end
end
