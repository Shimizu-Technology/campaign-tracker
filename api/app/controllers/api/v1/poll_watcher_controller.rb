# frozen_string_literal: true

module Api
  module V1
    class PollWatcherController < ApplicationController
      include Authenticatable
      before_action :authenticate_request
      before_action :require_poll_watcher_access!

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
          compliance_note: campaign_operations_compliance_note,
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

      # GET /api/v1/poll_watcher/strike_list?precinct_id=123&turnout_status=not_yet_voted&search=john
      def strike_list
        precinct = resolve_accessible_precinct_from_params
        return unless precinct

        supporters = supporters_scope_for_precinct(precinct.id)
        supporters = supporters.where(turnout_status: params[:turnout_status]) if params[:turnout_status].present?

        if params[:search].present?
          query = "%#{params[:search].to_s.downcase.strip}%"
          supporters = supporters.where(
            "LOWER(print_name) LIKE :q OR regexp_replace(contact_number, '\\D', '', 'g') LIKE :q",
            q: query
          )
        end

        render json: {
          compliance_note: campaign_operations_compliance_note,
          precinct: {
            id: precinct.id,
            number: precinct.number,
            village_id: precinct.village_id,
            village_name: precinct.village.name
          },
          supporters: supporters.limit(250).map { |supporter| strike_list_supporter_payload(supporter) }
        }
      end

      # PATCH /api/v1/poll_watcher/strike_list/:supporter_id/turnout
      def update_turnout
        supporter = find_accessible_supporter!(params[:supporter_id], turnout_update_params[:precinct_id])
        return unless supporter

        original_turnout_status = supporter.turnout_status
        supporter.assign_attributes(
          turnout_status: turnout_update_params[:turnout_status],
          turnout_note: turnout_update_params[:note],
          turnout_updated_at: Time.current,
          turnout_updated_by_user: current_user,
          turnout_source: turnout_source_for_current_user
        )

        if supporter.save
          changed_data = supporter.saved_changes.slice("turnout_status", "turnout_note", "turnout_updated_at", "turnout_updated_by_user_id", "turnout_source")
          log_turnout_audit!(supporter, precinct_id: supporter.precinct_id, changed_data: changed_data)
          render json: {
            message: "Supporter turnout status updated",
            compliance_note: campaign_operations_compliance_note,
            supporter: strike_list_supporter_payload(supporter),
            changed: {
              turnout_status: [ original_turnout_status, supporter.turnout_status ]
            }
          }
        else
          render json: { errors: supporter.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/poll_watcher/strike_list/:supporter_id/contact_attempts
      def create_contact_attempt
        supporter = find_accessible_supporter!(params[:supporter_id], contact_attempt_params[:precinct_id])
        return unless supporter

        attempt = supporter.supporter_contact_attempts.new(
          outcome: contact_attempt_params[:outcome],
          channel: contact_attempt_params[:channel],
          note: contact_attempt_params[:note],
          recorded_at: Time.current,
          recorded_by_user: current_user
        )

        if attempt.save
          log_contact_attempt_audit!(attempt, supporter: supporter, precinct_id: supporter.precinct_id)
          render json: {
            message: "Contact attempt logged",
            compliance_note: campaign_operations_compliance_note,
            contact_attempt: {
              id: attempt.id,
              supporter_id: supporter.id,
              outcome: attempt.outcome,
              channel: attempt.channel,
              note: attempt.note,
              recorded_at: attempt.recorded_at.iso8601
            }
          }, status: :created
        else
          render json: { errors: attempt.errors.full_messages }, status: :unprocessable_entity
        end
      end

      private

      def report_params
        params.require(:report).permit(:precinct_id, :voter_count, :report_type, :notes)
      end

      def turnout_update_params
        params.require(:turnout).permit(:precinct_id, :turnout_status, :note)
      end

      def contact_attempt_params
        params.require(:contact_attempt).permit(:precinct_id, :outcome, :channel, :note)
      end

      def resolve_accessible_precinct_from_params
        precinct_id = params[:precinct_id]
        unless precinct_id.present?
          render_api_error(
            message: "precinct_id is required",
            status: :unprocessable_entity,
            code: "precinct_id_required"
          )
          return nil
        end

        precinct = precinct_scope_for_current_user.includes(:village).find_by(id: precinct_id)
        if precinct.nil?
          render_api_error(
            message: "Not authorized for this precinct",
            status: :forbidden,
            code: "precinct_not_authorized"
          )
          return nil
        end

        precinct
      end

      def supporters_scope_for_precinct(precinct_id)
        Supporter
          .includes(:village, :precinct, :supporter_contact_attempts)
          .where(precinct_id: precinct_id, status: "active")
          .order(:print_name)
      end

      def find_accessible_supporter!(supporter_id, precinct_id)
        precinct = precinct_scope_for_current_user.find_by(id: precinct_id)
        if precinct.nil?
          render_api_error(
            message: "Not authorized for this precinct",
            status: :forbidden,
            code: "precinct_not_authorized"
          )
          return nil
        end

        supporter = supporters_scope_for_precinct(precinct.id).find_by(id: supporter_id)
        if supporter.nil?
          render_api_error(
            message: "Supporter not found in this precinct",
            status: :not_found,
            code: "supporter_not_found"
          )
          return nil
        end

        supporter
      end

      def turnout_source_for_current_user
        return "poll_watcher" if current_user.poll_watcher?

        "admin_override"
      end

      def campaign_operations_compliance_note
        "Campaign operations tracking only; not official election records."
      end

      def log_turnout_audit!(supporter, precinct_id:, changed_data:)
        return if changed_data.blank?

        AuditLog.create!(
          auditable: supporter,
          actor_user: current_user,
          action: "turnout_updated",
          changed_data: normalized_changed_data(changed_data),
          metadata: {
            resource: "supporter_turnout",
            precinct_id: precinct_id,
            turnout_source: supporter.turnout_source,
            compliance_context: "campaign_operations_not_official_record"
          }
        )
      end

      def log_contact_attempt_audit!(attempt, supporter:, precinct_id:)
        AuditLog.create!(
          auditable: attempt,
          actor_user: current_user,
          action: "created",
          changed_data: normalized_changed_data(
            outcome: [ nil, attempt.outcome ],
            channel: [ nil, attempt.channel ],
            note: [ nil, attempt.note ],
            recorded_at: [ nil, attempt.recorded_at ],
            supporter_id: [ nil, supporter.id ]
          ),
          metadata: {
            resource: "supporter_contact_attempt",
            precinct_id: precinct_id,
            compliance_context: "campaign_operations_not_official_record"
          }
        )
      end

      def normalized_changed_data(changed_data)
        changed_data.each_with_object({}) do |(field, value), output|
          if value.is_a?(Array) && value.length == 2
            output[field] = { from: value[0], to: value[1] }
          else
            output[field] = { from: nil, to: value }
          end
        end
      end

      def strike_list_supporter_payload(supporter)
        latest_attempt = supporter.supporter_contact_attempts.max_by(&:recorded_at)
        {
          id: supporter.id,
          print_name: supporter.print_name,
          contact_number: supporter.contact_number,
          precinct_id: supporter.precinct_id,
          turnout_status: supporter.turnout_status,
          turnout_source: supporter.turnout_source,
          turnout_note: supporter.turnout_note,
          turnout_updated_at: supporter.turnout_updated_at&.iso8601,
          latest_contact_attempt: latest_attempt && {
            outcome: latest_attempt.outcome,
            channel: latest_attempt.channel,
            recorded_at: latest_attempt.recorded_at.iso8601
          }
        }
      end

      def precinct_scope_for_current_user
        scope = Precinct.all

        if current_user.admin?
          scope
        elsif current_user.coordinator?
          current_user.assigned_district_id.present? ? scope.joins(:village).where(villages: { district_id: current_user.assigned_district_id }) : scope
        elsif current_user.chief? || current_user.poll_watcher?
          current_user.assigned_village_id.present? ? scope.where(village_id: current_user.assigned_village_id) : scope.none
        else
          scope.none
        end
      end
    end
  end
end
