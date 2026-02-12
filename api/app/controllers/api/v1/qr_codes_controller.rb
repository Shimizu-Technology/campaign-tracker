# frozen_string_literal: true

require "rqrcode"

module Api
  module V1
    class QrCodesController < ApplicationController
      # GET /api/v1/qr_codes/:code
      # Returns a QR code SVG for the given leader code
      def show
        code = params[:id]
        base_url = ENV.fetch("FRONTEND_URL", "http://localhost:5175")
        signup_url = "#{base_url}/signup/#{code}"

        qr = RQRCode::QRCode.new(signup_url)
        svg = qr.as_svg(
          color: "1B3A6B",
          shape_rendering: "crispEdges",
          module_size: 6,
          standalone: true,
          use_path: true
        )

        render plain: svg, content_type: "image/svg+xml"
      end

      # GET /api/v1/qr_codes/:code/info
      def info
        code = params[:id]
        base_url = ENV.fetch("FRONTEND_URL", "http://localhost:5175")
        signup_url = "#{base_url}/signup/#{code}"
        signups = Supporter.where(leader_code: code).active.count

        render json: {
          code: code,
          signup_url: signup_url,
          signups_count: signups
        }
      end

      # POST /api/v1/qr_codes/generate
      # Generate a unique leader code
      def generate
        name = params[:name] || "Leader"
        village = params[:village] || "General"

        # Create a readable code from name + village
        prefix = name.split(" ").map { |w| w[0..1].upcase }.join
        suffix = village[0..2].upcase
        code = "#{prefix}-#{suffix}-#{SecureRandom.hex(2).upcase}"

        base_url = ENV.fetch("FRONTEND_URL", "http://localhost:5175")
        signup_url = "#{base_url}/signup/#{code}"

        render json: {
          code: code,
          signup_url: signup_url,
          qr_svg_url: "/api/v1/qr_codes/#{code}"
        }
      end
    end
  end
end
