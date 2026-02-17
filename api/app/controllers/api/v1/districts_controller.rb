module Api
  module V1
    class DistrictsController < ApplicationController
      include Authenticatable

      before_action :require_authenticated_user!

      # GET /api/v1/districts
      def index
        districts = District.includes(:villages).order(:name)
        render json: {
          districts: districts.map { |d|
            {
              id: d.id,
              name: d.name,
              description: d.description,
              village_ids: d.villages.pluck(:id),
              village_names: d.villages.order(:name).pluck(:name)
            }
          }
        }
      end
    end
  end
end
