# frozen_string_literal: true

module Api
  module V1
    class ScanController < ApplicationController
      include Authenticatable
      before_action :authenticate_request

      # POST /api/v1/scan
      # Accepts a base64 image and returns extracted form data
      def create
        image_data = params[:image]

        if image_data.blank?
          return render json: { error: "Image data is required" }, status: :unprocessable_entity
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
            raw_response: result[:raw_response]
          }, status: :unprocessable_entity
        end
      end
    end
  end
end
