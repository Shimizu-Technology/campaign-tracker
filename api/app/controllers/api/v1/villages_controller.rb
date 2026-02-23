# frozen_string_literal: true

module Api
  module V1
    class VillagesController < ApplicationController
      include Authenticatable
      before_action :authenticate_request, only: [ :show ]
      before_action :require_supporter_access!, only: [ :show ]

      # GET /api/v1/villages (public — for signup form dropdown)
      def index
        villages = Village.includes(:precincts).order(:name)
        render json: {
          villages: villages.map { |v|
            {
              id: v.id,
              name: v.name,
              region: v.region,
              registered_voters: v.registered_voters,
              precincts: v.precincts.order(:number).map { |p|
                { id: p.id, number: p.number, alpha_range: p.alpha_range }
              }
            }
          }
        }
      end

      # GET /api/v1/villages/:id
      def show
        scoped_villages = scoped_village_ids.nil? ? Village.all : Village.where(id: scoped_village_ids)
        village = scoped_villages.includes(:precincts, :blocks).find_by(id: params[:id])
        unless village
          return render_api_error(
            message: "Not authorized for this village",
            status: :forbidden,
            code: "village_access_required"
          )
        end
        campaign = Campaign.active.first

        quota = village.quotas.where(campaign: campaign).first
        verified_count = village.supporters.active.verified.count
        total_count = village.supporters.active.count
        unverified_count = village.supporters.active.unverified.count
        precinct_supporter_counts = village.supporters.active.verified.where.not(precinct_id: nil).group(:precinct_id).count
        unassigned_precinct_count = village.supporters.active.verified.where(precinct_id: nil).count

        render json: {
          village: {
            id: village.id,
            name: village.name,
            region: village.region,
            registered_voters: village.registered_voters,
            verified_count: verified_count,
            total_count: total_count,
            unverified_count: unverified_count,
            # Legacy compat
            supporter_count: verified_count,
            quota_target: quota&.target_count || 0,
            precincts: village.precincts.order(:number).map { |p|
              {
                id: p.id,
                number: p.number,
                alpha_range: p.alpha_range,
                registered_voters: p.registered_voters,
                polling_site: p.polling_site,
                supporter_count: precinct_supporter_counts[p.id] || 0
              }
            },
            unassigned_precinct_count: unassigned_precinct_count,
            blocks: village.blocks.order(:name).map { |b|
              {
                id: b.id,
                name: b.name,
                verified_count: b.supporters.active.verified.count,
                total_count: b.supporters.active.count,
                supporter_count: b.supporters.active.verified.count
              }
            }
          }
        }
      end

      private
    end
  end
end
