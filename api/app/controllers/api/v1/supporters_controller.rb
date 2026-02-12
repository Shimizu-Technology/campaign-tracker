# frozen_string_literal: true

require "csv"

module Api
  module V1
    class SupportersController < ApplicationController
      include Authenticatable
      before_action :authenticate_request, only: [:index, :check_duplicate, :export]

      # POST /api/v1/supporters (public signup — no auth required)
      def create
        supporter = Supporter.new(public_supporter_params)
        supporter.source = params[:leader_code].present? ? "qr_signup" : "staff_entry"
        supporter.status = "active"
        supporter.leader_code = params[:leader_code]

        # Default unchecked booleans to false (checkboxes send nothing when unchecked)
        supporter.registered_voter = false if supporter.registered_voter.nil?
        supporter.yard_sign = false if supporter.yard_sign.nil?
        supporter.motorcade_available = false if supporter.motorcade_available.nil?

        # Check for duplicates
        dupes = Supporter.potential_duplicates(supporter.print_name, supporter.village_id)
        if dupes.exists?
          supporter.status = "unverified" # Flag for review
        end

        if supporter.save
          # Send welcome SMS (async-safe, won't block response)
          SmsService.welcome_supporter(supporter) if supporter.contact_number.present?

          # Broadcast to connected clients
          CampaignBroadcast.new_supporter(supporter)

          render json: {
            message: "Si Yu'os Ma'åse! Thank you for supporting Josh & Tina!",
            supporter: supporter_json(supporter),
            duplicate_warning: supporter.status == "unverified"
          }, status: :created
        else
          render json: { errors: supporter.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/supporters (authenticated)
      def index
        supporters = Supporter.includes(:village, :precinct, :block)
          .order(created_at: :desc)

        # Filters
        supporters = supporters.where(village_id: params[:village_id]) if params[:village_id].present?
        supporters = supporters.where(status: params[:status]) if params[:status].present?
        supporters = supporters.where(source: params[:source]) if params[:source].present?
        supporters = supporters.where(registered_voter: true) if params[:registered_voter] == "true"
        supporters = supporters.where(motorcade_available: true) if params[:motorcade_available] == "true"

        if params[:search].present?
          q = "%#{params[:search].downcase}%"
          supporters = supporters.where("LOWER(print_name) LIKE ? OR contact_number LIKE ?", q, q)
        end

        # Pagination
        page = (params[:page] || 1).to_i
        per_page = (params[:per_page] || 50).to_i
        total = supporters.count
        supporters = supporters.offset((page - 1) * per_page).limit(per_page)

        render json: {
          supporters: supporters.map { |s| supporter_json(s) },
          pagination: { page: page, per_page: per_page, total: total, pages: (total.to_f / per_page).ceil }
        }
      end

      # GET /api/v1/supporters/export
      def export
        supporters = Supporter.includes(:village, :precinct).order(created_at: :desc)
        supporters = supporters.where(village_id: params[:village_id]) if params[:village_id].present?
        supporters = supporters.where(status: params[:status]) if params[:status].present?

        csv_data = CSV.generate(headers: true) do |csv|
          csv << ["Name", "Phone", "Village", "Precinct", "Street Address", "Email", "DOB",
                  "Registered Voter", "Yard Sign", "Motorcade Available", "Source", "Date Signed Up"]
          supporters.find_each do |s|
            csv << [
              s.print_name, s.contact_number, s.village&.name, s.precinct&.number,
              s.street_address, s.email, s.dob&.strftime("%m/%d/%Y"),
              s.registered_voter ? "Yes" : "No",
              s.yard_sign ? "Yes" : "No",
              s.motorcade_available ? "Yes" : "No",
              s.source&.humanize,
              s.created_at&.strftime("%m/%d/%Y")
            ]
          end
        end

        send_data csv_data,
          filename: "supporters-#{Date.current.iso8601}.csv",
          type: "text/csv",
          disposition: "attachment"
      end

      # GET /api/v1/supporters/check_duplicate
      def check_duplicate
        name = params[:name]
        village_id = params[:village_id]
        dupes = Supporter.potential_duplicates(name, village_id)
        render json: { duplicates: dupes.map { |s| supporter_json(s) } }
      end

      private

      def public_supporter_params
        params.require(:supporter).permit(
          :print_name, :contact_number, :dob, :email, :street_address,
          :village_id, :precinct_id, :registered_voter,
          :yard_sign, :motorcade_available
        )
      end

      def supporter_json(supporter)
        {
          id: supporter.id,
          print_name: supporter.print_name,
          contact_number: supporter.contact_number,
          dob: supporter.dob,
          email: supporter.email,
          street_address: supporter.street_address,
          village_id: supporter.village_id,
          village_name: supporter.village&.name,
          precinct_id: supporter.precinct_id,
          precinct_number: supporter.precinct&.number,
          block_id: supporter.block_id,
          registered_voter: supporter.registered_voter,
          yard_sign: supporter.yard_sign,
          motorcade_available: supporter.motorcade_available,
          source: supporter.source,
          status: supporter.status,
          leader_code: supporter.leader_code,
          reliability_score: supporter.reliability_score,
          created_at: supporter.created_at&.iso8601
        }
      end
    end
  end
end
