# frozen_string_literal: true

module Api
  module V1
    class PollWatcherController < ApplicationController
      include Authenticatable
      before_action :authenticate_request

      # GET /api/v1/poll_watcher
      # Returns all precincts grouped by village with latest report data
      def index
        accessible_precincts = precinct_scope_for_current_user.includes(:village).order(:number)
        latest_reports = PollReport.today
          .latest_per_precinct
          .where(precinct_id: accessible_precincts.select(:id))
          .index_by(&:precinct_id)

        villages = accessible_precincts.group_by(&:village).sort_by { |village, _| village.name }.map do |village, village_precincts|
          precincts = village_precincts.map do |p|
            report = latest_reports[p.id]
            {
              id: p.id,
              number: p.number,
              polling_site: p.polling_site,
              registered_voters: p.registered_voters,
              alpha_range: p.alpha_range,
              last_voter_count: report&.voter_count,
              last_report_type: report&.report_type,
              last_report_at: report&.reported_at&.iso8601,
              last_notes: report&.notes,
              turnout_pct: report && p.registered_voters&.positive? ?
                (report.voter_count * 100.0 / p.registered_voters).round(1) : nil,
              reporting: report.present?
            }
          end

          {
            id: village.id,
            name: village.name,
            precincts: precincts,
            reporting_count: precincts.count { |p| p[:reporting] },
            total_precincts: precincts.size
          }
        end

        # Island-wide stats
        total_precincts = accessible_precincts.size
        reporting = latest_reports.size
        total_voters_reported = latest_reports.values.sum(&:voter_count)
        total_registered = accessible_precincts.sum { |p| p.registered_voters || 0 }

        render json: {
          villages: villages,
          stats: {
            total_precincts: total_precincts,
            reporting_precincts: reporting,
            reporting_pct: total_precincts > 0 ? (reporting * 100.0 / total_precincts).round(1) : 0,
            total_voters_reported: total_voters_reported,
            total_registered_reporting: total_registered,
            overall_turnout_pct: total_registered > 0 ? (total_voters_reported * 100.0 / total_registered).round(1) : 0
          }
        }
      end

      # POST /api/v1/poll_watcher/report
      def report
        precinct = precinct_scope_for_current_user.find_by(id: report_params[:precinct_id])
        unless precinct
          return render_api_error(
            message: "Not authorized for this precinct",
            status: :forbidden,
            code: "precinct_not_authorized"
          )
        end

        report = PollReport.new(report_params)
        report.precinct = precinct
        report.user = current_user
        report.reported_at = Time.current

        if report.save
          # Broadcast to war room / dashboard
          CampaignBroadcast.poll_report(report)

          render json: {
            message: "Report submitted for Precinct #{precinct.number}",
            report: {
              id: report.id,
              precinct_number: precinct.number,
              village_name: precinct.village.name,
              voter_count: report.voter_count,
              report_type: report.report_type,
              reported_at: report.reported_at.iso8601
            }
          }, status: :created
        else
          render json: { errors: report.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/poll_watcher/precinct/:id/history
      def history
        precinct = precinct_scope_for_current_user.find_by(id: params[:id])
        unless precinct
          return render_api_error(
            message: "Not authorized for this precinct",
            status: :forbidden,
            code: "precinct_not_authorized"
          )
        end

        reports = precinct.poll_reports.today.chronological.limit(50)

        render json: {
          precinct: {
            id: precinct.id,
            number: precinct.number,
            village_name: precinct.village.name,
            registered_voters: precinct.registered_voters
          },
          reports: reports.map { |r|
            {
              id: r.id,
              voter_count: r.voter_count,
              report_type: r.report_type,
              notes: r.notes,
              reported_at: r.reported_at.iso8601
            }
          }
        }
      end

      private

      def report_params
        params.require(:report).permit(:precinct_id, :voter_count, :report_type, :notes)
      end

      def precinct_scope_for_current_user
        scope = Precinct.all

        if current_user.admin?
          scope
        elsif current_user.coordinator?
          current_user.assigned_district_id.present? ? scope.joins(:village).where(villages: { district_id: current_user.assigned_district_id }) : scope
        elsif current_user.chief? || current_user.leader? || current_user.poll_watcher?
          current_user.assigned_village_id.present? ? scope.where(village_id: current_user.assigned_village_id) : scope.none
        else
          scope.none
        end
      end
    end
  end
end
