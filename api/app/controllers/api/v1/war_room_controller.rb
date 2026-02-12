# frozen_string_literal: true

module Api
  module V1
    class WarRoomController < ApplicationController
      include Authenticatable
      before_action :authenticate_request

      # GET /api/v1/war_room
      def index
        latest_reports = PollReport.today.latest_per_precinct.index_by(&:precinct_id)
        all_reports_today = PollReport.today.chronological.limit(20)

        # Village-level aggregation
        villages = Village.includes(:precincts).order(:name).map do |village|
          precinct_ids = village.precincts.pluck(:id)
          village_reports = latest_reports.values_at(*precinct_ids).compact
          total_registered = village.precincts.sum(:registered_voters)
          total_voted = village_reports.sum(&:voter_count)
          reporting_count = village_reports.size

          # Supporters who haven't been contacted / need calls
          supporter_count = village.supporters.active.count
          motorcade_count = village.supporters.active.where(motorcade_available: true).count

          {
            id: village.id,
            name: village.name,
            region: village.region,
            total_precincts: village.precincts.size,
            reporting_precincts: reporting_count,
            registered_voters: total_registered,
            voters_reported: total_voted,
            turnout_pct: total_registered > 0 ? (total_voted * 100.0 / total_registered).round(1) : 0,
            supporter_count: supporter_count,
            motorcade_count: motorcade_count,
            status: reporting_count == 0 ? "no_data" :
                    (total_voted * 100.0 / [total_registered, 1].max) >= 50 ? "strong" :
                    (total_voted * 100.0 / [total_registered, 1].max) >= 30 ? "moderate" : "low",
            has_issues: village_reports.any? { |r| r.report_type == "issue" }
          }
        end

        # Island-wide stats
        total_precincts = Precinct.count
        reporting = latest_reports.size
        total_voted = latest_reports.values.sum(&:voter_count)
        total_registered = Precinct.sum(:registered_voters)

        # Time-based activity
        last_hour_reports = PollReport.where("reported_at >= ?", 1.hour.ago).count

        # Call bank priorities — villages with low turnout but many supporters
        call_priorities = villages
          .select { |v| v[:reporting_precincts] > 0 && v[:turnout_pct] < 40 && v[:supporter_count] > 20 }
          .sort_by { |v| v[:turnout_pct] }
          .first(5)

        # Recent activity feed
        activity = all_reports_today.map do |r|
          {
            id: r.id,
            precinct_number: r.precinct.number,
            village_name: r.precinct.village.name,
            voter_count: r.voter_count,
            report_type: r.report_type,
            notes: r.notes,
            reported_at: r.reported_at.iso8601
          }
        end

        render json: {
          villages: villages,
          stats: {
            total_precincts: total_precincts,
            reporting_precincts: reporting,
            reporting_pct: total_precincts > 0 ? (reporting * 100.0 / total_precincts).round(1) : 0,
            total_voted: total_voted,
            total_registered: total_registered,
            island_turnout_pct: total_registered > 0 ? (total_voted * 100.0 / total_registered).round(1) : 0,
            last_hour_reports: last_hour_reports,
            total_supporters: Supporter.active.count
          },
          call_priorities: call_priorities,
          activity: activity
        }
      end
    end
  end
end
