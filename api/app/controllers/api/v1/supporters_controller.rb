# frozen_string_literal: true

require "csv"

module Api
  module V1
    class SupportersController < ApplicationController
      MAX_PER_PAGE = 200
      MAX_EXPORT_ROWS = 10_000
      ALLOWED_SORT_FIELDS = %w[created_at print_name village_name precinct_number source registered_voter].freeze

      include Authenticatable
      before_action :authenticate_request, only: [ :index, :check_duplicate, :export, :show, :update ]
      before_action :require_supporter_access!, only: [ :index, :check_duplicate, :export, :show ]

      # POST /api/v1/supporters (public signup — no auth required)
      def create
        if staff_entry_mode?
          authenticate_request
          return if performed?
          require_staff_entry_access!
          return if performed?
        end

        supporter = Supporter.new(public_supporter_params)
        supporter.source = create_source
        supporter.status = "active"
        supporter.leader_code = params[:leader_code]
        supporter.entered_by_user_id = current_user.id if staff_entry_mode? && current_user

        # Default unchecked booleans to false (checkboxes send nothing when unchecked)
        supporter.registered_voter = false if supporter.registered_voter.nil?
        supporter.yard_sign = false if supporter.yard_sign.nil?
        supporter.motorcade_available = false if supporter.motorcade_available.nil?

        # Check for duplicates
        dupes = Supporter.potential_duplicates(supporter.print_name, supporter.village_id)
        if dupes.exists?
          supporter.status = "unverified" # Flag for review
        end
        assign_default_precinct_if_single!(supporter)

        if supporter.save
          log_audit!(supporter, action: "created", changed_data: supporter.saved_changes.except("updated_at"))

          # Queue welcome SMS so signup response is not blocked by external API latency.
          if supporter.contact_number.present?
            SendSmsJob.perform_later(
              to: supporter.contact_number,
              body: SmsService.welcome_supporter_body(supporter)
            )
          end

          # Broadcast to connected clients
          CampaignBroadcast.new_supporter(supporter)

          render json: {
            message: "Si Yu'os Ma'åse! Thank you for supporting Josh & Tina!",
            supporter: supporter_json(supporter),
            duplicate_warning: supporter.status == "unverified"
          }, status: :created
        else
          render json: { errors: supporter.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/supporters/:id
      def update
        unless supporter_edit_allowed?
          return render_api_error(
            message: "You do not have permission to edit supporters",
            status: :forbidden,
            code: "supporter_edit_access_required"
          )
        end

        supporter = Supporter.find(params[:id])
        updates = supporter_update_params.to_h
        updates[:precinct_id] = nil if updates.key?(:precinct_id) && updates[:precinct_id].blank?

        if supporter.update(updates)
          changes = supporter.saved_changes.except("updated_at")
          log_audit!(supporter, action: "updated", changed_data: changes) if changes.present?
          render json: { supporter: supporter_json(supporter) }
        else
          render_api_error(
            message: supporter.errors.full_messages.join(", "),
            status: :unprocessable_entity,
            code: "supporter_update_failed"
          )
        end
      end

      # GET /api/v1/supporters (authenticated)
      def index
        supporters = Supporter.includes(:village, :precinct, :block)

        # Filters
        supporters = supporters.where(village_id: params[:village_id]) if params[:village_id].present?
        if params[:unassigned_precinct] == "true"
          supporters = supporters.where(precinct_id: nil)
        elsif params[:precinct_id].present?
          supporters = supporters.where(precinct_id: params[:precinct_id])
        end
        supporters = supporters.where(status: params[:status]) if params[:status].present?
        supporters = supporters.where(source: params[:source]) if params[:source].present?
        supporters = supporters.where(registered_voter: true) if params[:registered_voter] == "true"
        supporters = supporters.where(motorcade_available: true) if params[:motorcade_available] == "true"

        if params[:search].present?
          raw = params[:search].to_s.strip
          name_query = "%#{raw.downcase}%"
          phone_digits = raw.gsub(/\D/, "")
          if phone_digits.present?
            phone_query = "%#{phone_digits}%"
            supporters = supporters.where(
              "LOWER(print_name) LIKE :name_query OR regexp_replace(contact_number, '\\D', '', 'g') LIKE :phone_query",
              name_query: name_query,
              phone_query: phone_query
            )
          else
            supporters = supporters.where("LOWER(print_name) LIKE ?", name_query)
          end
        end
        supporters = apply_index_sort(supporters)

        # Pagination
        page = [ (params[:page] || 1).to_i, 1 ].max
        requested_per_page = (params[:per_page] || 50).to_i
        per_page = requested_per_page.clamp(1, MAX_PER_PAGE)
        total = supporters.count
        supporters = supporters.offset((page - 1) * per_page).limit(per_page)

        render json: {
          supporters: supporters.map { |s| supporter_json(s) },
          pagination: { page: page, per_page: per_page, total: total, pages: (total.to_f / per_page).ceil }
        }
      end

      # GET /api/v1/supporters/:id
      def show
        supporter = Supporter.includes(:village, :precinct, :block, event_rsvps: :event).find(params[:id])
        audit_logs = supporter.audit_logs.includes(:actor_user).recent.limit(50)

        render json: {
          supporter: supporter_detail_json(supporter),
          permissions: {
            can_edit: supporter_edit_allowed?
          },
          audit_logs: audit_logs.map do |log|
            {
              id: log.id,
              action: log.action,
              action_label: audit_action_label(log.action),
              actor_user_id: log.actor_user_id,
              actor_name: log.actor_user&.name,
              actor_role: log.actor_user&.role,
              changed_data: log.changed_data,
              metadata: log.metadata,
              created_at: log.created_at&.iso8601
            }
          end
        }
      end

      # GET /api/v1/supporters/export
      def export
        supporters = Supporter.includes(:village, :precinct).order(created_at: :desc)
        supporters = supporters.where(village_id: params[:village_id]) if params[:village_id].present?
        supporters = supporters.where(status: params[:status]) if params[:status].present?
        total = supporters.count

        if total > MAX_EXPORT_ROWS
          return render_api_error(
            message: "Export too large (#{total} rows). Please add filters to export up to #{MAX_EXPORT_ROWS} rows.",
            status: :unprocessable_entity,
            code: "supporters_export_too_large",
            details: { total_rows: total, max_rows: MAX_EXPORT_ROWS }
          )
        end

        csv_data = CSV.generate(headers: true) do |csv|
          csv << [ "Name", "Phone", "Village", "Precinct", "Street Address", "Email", "DOB",
                  "Registered Voter", "Yard Sign", "Motorcade Available", "Source", "Date Signed Up" ]
          supporters.find_each do |s|
            csv << [
              s.print_name, s.contact_number, s.village&.name, s.precinct&.number,
              s.street_address, s.email, s.dob&.strftime("%m/%d/%Y"),
              s.registered_voter ? "Yes" : "No",
              s.yard_sign ? "Yes" : "No",
              s.motorcade_available ? "Yes" : "No",
              s.source&.humanize,
              s.created_at&.strftime("%m/%d/%Y")
            ]
          end
        end

        send_data csv_data,
          filename: "supporters-#{Date.current.iso8601}.csv",
          type: "text/csv",
          disposition: "attachment"
      end

      # GET /api/v1/supporters/check_duplicate
      def check_duplicate
        name = params[:name]
        village_id = params[:village_id]
        dupes = Supporter.potential_duplicates(name, village_id)
        render json: { duplicates: dupes.map { |s| supporter_json(s) } }
      end

      private

      def public_supporter_params
        params.require(:supporter).permit(
          :print_name, :contact_number, :dob, :email, :street_address,
          :village_id, :precinct_id, :registered_voter,
          :yard_sign, :motorcade_available
        )
      end

      def supporter_update_params
        params.require(:supporter).permit(
          :print_name, :contact_number, :email, :dob, :street_address,
          :village_id, :precinct_id, :registered_voter, :yard_sign, :motorcade_available
        )
      end

      def create_source
        return "qr_signup" if params[:leader_code].present?
        return "staff_entry" if staff_entry_mode?

        # Public non-authenticated signup without leader code.
        "qr_signup"
      end

      def staff_entry_mode?
        params[:entry_mode] == "staff"
      end

      def assign_default_precinct_if_single!(supporter)
        return if supporter.precinct_id.present? || supporter.village_id.blank?

        precinct_ids = Precinct.where(village_id: supporter.village_id).limit(2).pluck(:id)
        supporter.precinct_id = precinct_ids.first if precinct_ids.one?
      end

      def supporter_json(supporter)
        {
          id: supporter.id,
          print_name: supporter.print_name,
          contact_number: supporter.contact_number,
          dob: supporter.dob,
          email: supporter.email,
          street_address: supporter.street_address,
          village_id: supporter.village_id,
          village_name: supporter.village&.name,
          precinct_id: supporter.precinct_id,
          precinct_number: supporter.precinct&.number,
          block_id: supporter.block_id,
          registered_voter: supporter.registered_voter,
          yard_sign: supporter.yard_sign,
          motorcade_available: supporter.motorcade_available,
          source: supporter.source,
          status: supporter.status,
          leader_code: supporter.leader_code,
          reliability_score: supporter.reliability_score,
          created_at: supporter.created_at&.iso8601
        }
      end

      def supporter_detail_json(supporter)
        supporter_json(supporter).merge(
          block_name: supporter.block&.name,
          events_invited_count: supporter.event_rsvps.size,
          events_attended_count: supporter.event_rsvps.count(&:attended),
          event_history: supporter.event_rsvps.sort_by(&:created_at).reverse.first(20).map do |rsvp|
            {
              event_id: rsvp.event_id,
              event_name: rsvp.event&.name,
              event_date: rsvp.event&.date&.to_s,
              rsvp_status: rsvp.rsvp_status,
              attended: rsvp.attended,
              checked_in_at: rsvp.checked_in_at&.iso8601
            }
          end
        )
      end

      def log_audit!(supporter, action:, changed_data:)
        AuditLog.create!(
          auditable: supporter,
          actor_user: current_user,
          action: action,
          changed_data: normalized_changed_data(changed_data),
          metadata: {
            entry_mode: params[:entry_mode],
            leader_code: params[:leader_code]
          }.compact
        )
      end

      def supporter_edit_allowed?
        current_user&.admin? || current_user&.coordinator?
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

      def audit_action_label(action)
        case action
        when "created"
          "Supporter created"
        when "updated"
          "Supporter updated"
        else
          action.to_s.humanize
        end
      end

      def apply_index_sort(scope)
        sort_by = ALLOWED_SORT_FIELDS.include?(params[:sort_by]) ? params[:sort_by] : "created_at"
        sort_dir = params[:sort_dir] == "asc" ? :asc : :desc
        sort_dir_sql = sort_dir == :asc ? "ASC" : "DESC"

        case sort_by
        when "village_name"
          scope.left_joins(:village).reorder(Arel.sql("villages.name #{sort_dir_sql}"), created_at: :desc)
        when "precinct_number"
          scope.left_joins(:precinct).reorder(Arel.sql("precincts.number #{sort_dir_sql}"), created_at: :desc)
        else
          scope.reorder(sort_by => sort_dir)
        end
      end
    end
  end
end
