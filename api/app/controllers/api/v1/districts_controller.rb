module Api
  module V1
    class DistrictsController < ApplicationController
      include Authenticatable

      before_action :require_authenticated_user!
      before_action :require_admin!, only: [ :create, :update, :destroy, :assign_villages ]

      # GET /api/v1/districts
      def index
        districts = District.includes(:villages).order(:name)
        unassigned_villages = Village.where(district_id: nil).order(:name)

        render json: {
          districts: districts.map { |d| district_json(d) },
          unassigned_villages: unassigned_villages.map { |v| village_summary(v) }
        }
      end

      # POST /api/v1/districts
      def create
        campaign = Campaign.active.first
        unless campaign
          return render_api_error(message: "No active campaign", status: :unprocessable_entity)
        end

        district = District.new(district_params.merge(campaign_id: campaign.id))
        if district.save
          render json: { district: district_json(district) }, status: :created
        else
          render_api_error(
            message: district.errors.full_messages.join(", "),
            status: :unprocessable_entity
          )
        end
      end

      # PATCH /api/v1/districts/:id
      def update
        district = District.find(params[:id])
        if district.update(district_params)
          render json: { district: district_json(district) }
        else
          render_api_error(
            message: district.errors.full_messages.join(", "),
            status: :unprocessable_entity
          )
        end
      end

      # DELETE /api/v1/districts/:id
      def destroy
        district = District.find(params[:id])
        # Nullify village associations (don't delete villages)
        district.destroy!
        render json: { message: "District deleted" }
      end

      # PATCH /api/v1/districts/:id/assign_villages
      def assign_villages
        district = District.find(params[:id])
        village_ids = Array(params[:village_ids]).map(&:to_i)

        # Remove villages currently in this district that aren't in the new list
        district.villages.where.not(id: village_ids).update_all(district_id: nil)

        # Assign new villages (pull from other districts if needed)
        Village.where(id: village_ids).update_all(district_id: district.id) if village_ids.any?

        district.reload
        render json: { district: district_json(district) }
      end

      private

      def district_params
        params.require(:district).permit(:name, :description)
      end

      def district_json(district)
        {
          id: district.id,
          name: district.name,
          description: district.description,
          villages: district.villages.order(:name).map { |v| village_summary(v) },
          supporter_count: Supporter.active.where(village_id: district.village_ids).count,
          registered_voters: district.villages.joins(:precincts).sum("precincts.registered_voters")
        }
      end

      def village_summary(village)
        {
          id: village.id,
          name: village.name,
          supporter_count: village.supporters.active.count,
          registered_voters: village.registered_voters
        }
      end
    end
  end
end
