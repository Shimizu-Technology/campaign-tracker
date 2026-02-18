# frozen_string_literal: true

module Api
  module V1
    class WarRoomController < ApplicationController
      include Authenticatable
      before_action :authenticate_request
      before_action :require_war_room_access!

      # GET /api/v1/war_room
      def index
        scoped_ids = scoped_village_ids
        village_scope = scoped_ids.nil? ? Village.all : Village.where(id: scoped_ids)
        precinct_scope = scoped_ids.nil? ? Precinct.all : Precinct.where(village_id: scoped_ids)
        supporter_scope = scoped_ids.nil? ? Supporter.active : Supporter.active.where(village_id: scoped_ids)

        precinct_rows = precinct_scope.select(:id, :village_id, :registered_voters)
        accessible_precinct_ids = precinct_rows.map(&:id)

        latest_reports = PollReport.today
          .latest_per_precinct
          .where(precinct_id: accessible_precinct_ids)
          .index_by(&:precinct_id)
        all_reports_today = PollReport.today
          .where(precinct_id: accessible_precinct_ids)
          .chronological
          .includes(precinct: :village)
          .limit(20)

        precinct_ids_by_village = Hash.new { |hash, key| hash[key] = [] }
        registered_voters_by_village = Hash.new(0)
        precinct_rows.each do |precinct|
          precinct_ids_by_village[precinct.village_id] << precinct.id
          registered_voters_by_village[precinct.village_id] += precinct.registered_voters.to_i
        end

        supporter_counts_by_village = supporter_scope.group(:village_id).count
        motorcade_counts_by_village = supporter_scope.where(motorcade_available: true).group(:village_id).count
        not_yet_voted_counts_by_village = supporter_scope.where(turnout_status: "not_yet_voted").group(:village_id).count
        outreach_attempted_counts_by_village = SupporterContactAttempt
          .joins(:supporter)
          .merge(supporter_scope)
          .where(outcome: "attempted")
          .group("supporters.village_id")
          .distinct
          .count(:supporter_id)
        outreach_reached_counts_by_village = SupporterContactAttempt
          .joins(:supporter)
          .merge(supporter_scope)
          .where(outcome: "reached")
          .group("supporters.village_id")
          .distinct
          .count(:supporter_id)

        # Village-level aggregation
        villages = village_scope.order(:name).map do |village|
          precinct_ids = precinct_ids_by_village[village.id]
          village_reports = latest_reports.values_at(*precinct_ids).compact
          total_registered = registered_voters_by_village[village.id]
          total_voted = village_reports.sum(&:voter_count)
          reporting_count = village_reports.size

          # Supporters who haven't been contacted / need calls
          supporter_count = supporter_counts_by_village[village.id] || 0
          motorcade_count = motorcade_counts_by_village[village.id] || 0
          not_yet_voted_count = not_yet_voted_counts_by_village[village.id] || 0
          outreach_attempted_count = outreach_attempted_counts_by_village[village.id] || 0
          outreach_reached_count = outreach_reached_counts_by_village[village.id] || 0

          {
            id: village.id,
            name: village.name,
            region: village.region,
            total_precincts: precinct_ids.size,
            reporting_precincts: reporting_count,
            registered_voters: total_registered,
            voters_reported: total_voted,
            turnout_pct: total_registered > 0 ? (total_voted * 100.0 / total_registered).round(1) : 0,
            supporter_count: supporter_count,
            motorcade_count: motorcade_count,
            not_yet_voted_count: not_yet_voted_count,
            outreach_attempted_count: outreach_attempted_count,
            outreach_reached_count: outreach_reached_count,
            status: reporting_count == 0 ? "no_data" :
                    (total_voted * 100.0 / [ total_registered, 1 ].max) >= 50 ? "strong" :
                    (total_voted * 100.0 / [ total_registered, 1 ].max) >= 30 ? "moderate" : "low",
            has_issues: village_reports.any? { |r| r.report_type == "issue" }
          }
        end

        # Island-wide stats
        total_precincts = precinct_rows.size
        reporting = latest_reports.size
        total_voted = latest_reports.values.sum(&:voter_count)
        total_registered = registered_voters_by_village.values.sum

        # Time-based activity
        last_hour_reports = PollReport.where("reported_at >= ?", 1.hour.ago).count

        # Call bank priorities — villages with low turnout but many supporters
        call_priorities = villages
          .select { |v| v[:reporting_precincts] > 0 && v[:turnout_pct] < 40 && v[:supporter_count] > 20 }
          .sort_by { |v| v[:turnout_pct] }
          .first(5)

        not_yet_voted_queue = villages
          .select { |v| v[:not_yet_voted_count].positive? }
          .sort_by { |v| [ -v[:not_yet_voted_count], v[:turnout_pct] ] }
          .first(8)
          .map do |v|
            {
              id: v[:id],
              name: v[:name],
              turnout_pct: v[:turnout_pct],
              not_yet_voted_count: v[:not_yet_voted_count],
              outreach_attempted_count: v[:outreach_attempted_count],
              outreach_reached_count: v[:outreach_reached_count]
            }
          end

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
            total_supporters: supporter_counts_by_village.values.sum,
            total_not_yet_voted: not_yet_voted_counts_by_village.values.sum,
            total_outreach_attempted: outreach_attempted_counts_by_village.values.sum,
            total_outreach_reached: outreach_reached_counts_by_village.values.sum
          },
          call_priorities: call_priorities,
          not_yet_voted_queue: not_yet_voted_queue,
          activity: activity
        }
      end
    end
  end
end
