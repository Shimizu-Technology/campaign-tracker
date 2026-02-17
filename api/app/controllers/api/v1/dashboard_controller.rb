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

        # Pace tracking: calculate expected progress based on linear interpolation
        # from campaign start to quota target date
        target_dates = if campaign
          Quota.where(campaign_id: campaign.id, village_id: village_ids)
               .group(:village_id)
               .maximum(:target_date)
        else
          {}
        end
        campaign_started_at = campaign&.started_at || campaign&.created_at&.to_date || Date.current

        villages = villages_base.map do |village|
          supporter_count = supporter_counts[village.id] || 0
          today_count = today_counts[village.id] || 0
          week_count = week_counts[village.id] || 0
          target = quota_targets[village.id] || 0
          percentage = target.positive? ? (supporter_count * 100.0 / target).round(1) : 0

          # Pace calculation
          pace = calculate_pace(
            supporter_count: supporter_count,
            target: target,
            started_at: campaign_started_at,
            target_date: target_dates[village.id]
          )

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
            status: percentage >= 75 ? "on_track" : percentage >= 50 ? "behind" : "critical",
            pace_expected: pace[:expected],
            pace_diff: pace[:diff],
            pace_status: pace[:status],
            pace_weekly_needed: pace[:weekly_needed]
          }
        end

        total_supporters = supporter_counts.values.sum
        total_target = villages.sum { |v| v[:quota_target] }
        total_percentage = total_target > 0 ? (total_supporters * 100.0 / total_target).round(1) : 0
        total_registered_voters = villages.sum { |v| v[:registered_voters].to_i }
        total_villages = villages.size
        total_precincts = villages.sum { |v| v[:precinct_count].to_i }

        # Overall pace
        overall_pace = calculate_pace(
          supporter_count: total_supporters,
          target: total_target,
          started_at: campaign_started_at,
          target_date: target_dates.values.compact.max
        )

        Rails.logger.info("[Dashboard] total_target=#{total_target} total_precincts=#{total_precincts} villages=#{villages.size}")

        render json: {
          campaign: campaign&.slice(:id, :name, :candidate_names, :election_year, :primary_color, :secondary_color)&.merge(show_pace: campaign&.show_pace || false),
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
            status: total_percentage >= 75 ? "on_track" : total_percentage >= 50 ? "behind" : "critical",
            pace_expected: overall_pace[:expected],
            pace_diff: overall_pace[:diff],
            pace_status: overall_pace[:status],
            pace_weekly_needed: overall_pace[:weekly_needed]
          },
          villages: villages
        }
      end

      private

      # Calculate pace metrics for a given supporter count against a target.
      # Returns expected count by now, diff (actual - expected), status, and weekly rate needed.
      def calculate_pace(supporter_count:, target:, started_at:, target_date:)
        return { expected: 0, diff: 0, status: "no_target", weekly_needed: 0 } if target <= 0
        return { expected: 0, diff: supporter_count, status: "no_deadline", weekly_needed: 0 } if target_date.blank?

        today = Date.current
        start_date = started_at || today
        total_days = (target_date - start_date).to_f
        elapsed_days = (today - start_date).to_f

        # If campaign hasn't started yet or total duration is zero/negative
        if elapsed_days <= 0 || total_days <= 0
          total_weeks = total_days > 0 ? (total_days / 7.0) : 1.0
          return { expected: 0, diff: supporter_count, status: "ahead", weekly_needed: (target / total_weeks).ceil }
        end

        # Past deadline
        if today > target_date
          return {
            expected: target,
            diff: supporter_count - target,
            status: supporter_count >= target ? "complete" : "overdue",
            weekly_needed: 0
          }
        end

        # Linear interpolation: where should we be right now?
        progress_fraction = elapsed_days / total_days
        expected = (target * progress_fraction).round

        diff = supporter_count - expected
        diff_pct = expected > 0 ? (diff.to_f / expected * 100) : 0

        # Status thresholds
        status = if diff >= 0
          "ahead"
        elsif diff_pct >= -10
          "slightly_behind"
        else
          "behind"
        end

        # How many per week needed to hit target from here?
        remaining_days = (target_date - today).to_f
        remaining_weeks = remaining_days / 7.0
        remaining_count = [ target - supporter_count, 0 ].max
        weekly_needed = remaining_weeks > 0 ? (remaining_count / remaining_weeks).ceil : remaining_count

        { expected: expected, diff: diff, status: status, weekly_needed: weekly_needed }
      end
    end
  end
end
