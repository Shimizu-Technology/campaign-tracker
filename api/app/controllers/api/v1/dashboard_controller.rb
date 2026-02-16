# frozen_string_literal: true

module Api
  module V1
    class DashboardController < ApplicationController
      include Authenticatable
      before_action :authenticate_request, only: [ :show ]

      # GET /api/v1/stats (public — no auth)
      def stats
        render json: {
          total_supporters: Supporter.active.count,
          verified_supporters: Supporter.active.verified.count,
          unverified_supporters: Supporter.active.unverified.count,
          flagged_supporters: Supporter.active.flagged.count,
          potential_duplicates: Supporter.active.potential_duplicates_only.count,
          total_villages: Village.count,
          campaign_name: Campaign.active.first&.name || "Josh & Tina 2026"
        }
      end

      # GET /api/v1/dashboard
      def show
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"

        campaign = Campaign.active.first
        Rails.logger.info("[Dashboard] user=#{current_user&.id} role=#{current_user&.role} campaign=#{campaign&.id}")
        villages_base = Village.includes(:precincts).order(:name).to_a
        village_ids = villages_base.map(&:id)
        supporter_counts = Supporter.active.where(village_id: village_ids).group(:village_id).count
        today_counts = Supporter.active.today.where(village_id: village_ids).group(:village_id).count
        week_counts = Supporter.active.this_week.where(village_id: village_ids).group(:village_id).count
        quota_targets = if campaign
          Quota.where(campaign_id: campaign.id, village_id: village_ids).group(:village_id).sum(:target_count)
        else
          {}
        end

        villages = villages_base.map do |village|
          supporter_count = supporter_counts[village.id] || 0
          today_count = today_counts[village.id] || 0
          week_count = week_counts[village.id] || 0
          target = quota_targets[village.id] || 0
          percentage = target.positive? ? (supporter_count * 100.0 / target).round(1) : 0

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

        total_supporters = supporter_counts.values.sum
        total_target = villages.sum { |v| v[:quota_target] }
        total_percentage = total_target > 0 ? (total_supporters * 100.0 / total_target).round(1) : 0
        total_registered_voters = villages.sum { |v| v[:registered_voters].to_i }
        total_villages = villages.size
        total_precincts = villages.sum { |v| v[:precinct_count].to_i }

        Rails.logger.info("[Dashboard] total_target=#{total_target} total_precincts=#{total_precincts} villages=#{villages.size}")

        render json: {
          campaign: campaign&.slice(:id, :name, :candidate_names, :election_year, :primary_color, :secondary_color),
          summary: {
            total_supporters: total_supporters,
            total_target: total_target,
            total_percentage: total_percentage,
            total_registered_voters: total_registered_voters,
            total_villages: total_villages,
            total_precincts: total_precincts,
            verified_supporters: Supporter.active.verified.where(village_id: village_ids).count,
            today_signups: today_counts.values.sum,
            week_signups: week_counts.values.sum,
            status: total_percentage >= 75 ? "on_track" : total_percentage >= 50 ? "behind" : "critical"
          },
          villages: villages
        }
      end
    end
  end
end
