# frozen_string_literal: true

module Api
  module V1
    class StaffSupportersController < ApplicationController
      include Authenticatable
      before_action :authenticate_request

      # POST /api/v1/staff/supporters (authenticated staff entry)
      def create
        supporter = Supporter.new(staff_supporter_params)
        supporter.source = "staff_entry"
        supporter.status = "active"
        supporter.entered_by_user_id = current_user.id

        # Check for duplicates
        dupes = Supporter.potential_duplicates(supporter.print_name, supporter.village_id)
        if dupes.exists? && params[:force] != "true"
          return render json: {
            duplicate_warning: true,
            message: "Possible duplicate found. Submit with force=true to override.",
            duplicates: dupes.map { |s| { id: s.id, print_name: s.print_name, contact_number: s.contact_number, village: s.village&.name } }
          }, status: :conflict
        end

        if supporter.save
          render json: { supporter: supporter_json(supporter) }, status: :created
        else
          render json: { errors: supporter.errors.full_messages }, status: :unprocessable_entity
        end
      end

      private

      def staff_supporter_params
        params.require(:supporter).permit(
          :print_name, :contact_number, :dob, :email, :street_address,
          :village_id, :precinct_id, :block_id,
          :registered_voter, :yard_sign, :motorcade_available
        )
      end

      def supporter_json(supporter)
        {
          id: supporter.id,
          print_name: supporter.print_name,
          contact_number: supporter.contact_number,
          village_name: supporter.village&.name,
          source: supporter.source,
          status: supporter.status,
          created_at: supporter.created_at&.iso8601
        }
      end
    end
  end
end
