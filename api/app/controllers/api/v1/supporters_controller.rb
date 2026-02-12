# frozen_string_literal: true

module Api
  module V1
    class SupportersController < ApplicationController
      # POST /api/v1/supporters (public signup — no auth required)
      def create
        supporter = Supporter.new(public_supporter_params)
        supporter.source = params[:leader_code].present? ? "qr_signup" : "qr_signup"
        supporter.status = "active"
        supporter.leader_code = params[:leader_code]

        # Check for duplicates
        dupes = Supporter.potential_duplicates(supporter.print_name, supporter.village_id)
        if dupes.exists?
          supporter.status = "unverified" # Flag for review
        end

        if supporter.save
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
