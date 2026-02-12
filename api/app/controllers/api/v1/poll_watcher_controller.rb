# frozen_string_literal: true

module Api
  module V1
    class PollWatcherController < ApplicationController
      include Authenticatable
      before_action :authenticate_request

      # GET /api/v1/poll_watcher
      # Returns all precincts grouped by village with latest report data
      def index
        latest_reports = PollReport.today.latest_per_precinct.index_by(&:precinct_id)

        villages = Village.includes(:precincts).order(:name).map do |village|
          precincts = village.precincts.order(:number).map do |p|
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
        total_precincts = Precinct.count
        reporting = latest_reports.size
        total_voters_reported = latest_reports.values.sum(&:voter_count)
        total_registered = Precinct.where(id: latest_reports.keys).sum(:registered_voters)

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
        report = PollReport.new(report_params)
        report.user = current_user
        report.reported_at = Time.current

        if report.save
          precinct = report.precinct

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
        precinct = Precinct.find(params[:id])
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
    end
  end
end
