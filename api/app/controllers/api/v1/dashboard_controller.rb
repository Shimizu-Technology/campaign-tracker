# frozen_string_literal: true

module Api
  module V1
    class DashboardController < ApplicationController
      include Authenticatable
      before_action :authenticate_request, only: [:show]

      # GET /api/v1/stats (public — no auth)
      def stats
        render json: {
          total_supporters: Supporter.active.count,
          total_villages: Village.count,
          campaign_name: Campaign.active.first&.name || "Josh & Tina 2026"
        }
      end

      # GET /api/v1/dashboard
      def show
        campaign = Campaign.active.first

        villages = Village.includes(:precincts, :quotas).order(:name).map do |village|
          quota = village.quotas.where(campaign: campaign).first
          supporter_count = village.supporters.active.count
          today_count = village.supporters.active.today.count
          week_count = village.supporters.active.this_week.count

          target = quota&.target_count || 0
          percentage = target > 0 ? (supporter_count * 100.0 / target).round(1) : 0

          {
            id: village.id,
            name: village.name,
            region: village.region,
            registered_voters: village.registered_voters,
            precinct_count: village.precinct_count,
            supporter_count: supporter_count,
            today_count: today_count,
            week_count: week_count,
            quota_target: target,
            quota_percentage: percentage,
            status: percentage >= 75 ? "on_track" : percentage >= 50 ? "behind" : "critical"
          }
        end

        total_supporters = Supporter.active.count
        total_target = villages.sum { |v| v[:quota_target] }
        total_percentage = total_target > 0 ? (total_supporters * 100.0 / total_target).round(1) : 0

        render json: {
          campaign: campaign&.slice(:id, :name, :candidate_names, :election_year, :primary_color, :secondary_color),
          summary: {
            total_supporters: total_supporters,
            total_target: total_target,
            total_percentage: total_percentage,
            total_registered_voters: Village.sum(:registered_voters),
            total_villages: Village.count,
            total_precincts: Precinct.count,
            today_signups: Supporter.active.today.count,
            week_signups: Supporter.active.this_week.count,
            status: total_percentage >= 75 ? "on_track" : total_percentage >= 50 ? "behind" : "critical"
          },
          villages: villages
        }
      end
    end
  end
end
