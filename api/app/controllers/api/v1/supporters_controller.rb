# frozen_string_literal: true

require "csv"

module Api
  module V1
    class SupportersController < ApplicationController
      MAX_PER_PAGE = 200
      MAX_EXPORT_ROWS = 10_000
      ALLOWED_SORT_FIELDS = %w[created_at print_name last_name first_name village_name precinct_number source registered_voter].freeze

      include Authenticatable
      include AuditLoggable
      before_action :authenticate_request, only: [ :index, :check_duplicate, :export, :show, :update, :verify, :bulk_verify, :duplicates, :resolve_duplicate, :scan_duplicates, :outreach, :outreach_status ]
      before_action :require_supporter_access!, only: [ :index, :check_duplicate, :export, :show, :outreach, :outreach_status ]
      before_action :require_coordinator_or_above!, only: [ :duplicates, :resolve_duplicate, :scan_duplicates ]
      before_action :require_chief_or_above!, only: [ :verify, :bulk_verify ]

      # POST /api/v1/supporters (public signup — no auth required)
      def create
        if staff_entry_mode?
          authenticate_request
          return if performed?
          require_staff_entry_access!
          return if performed?

          # Enforce village scope for staff entries by scoped users
          village_id = public_supporter_params[:village_id]
          if village_id.present? && scoped_village_ids && !scoped_village_ids.include?(village_id.to_i)
            return render json: { errors: [ "Village not in your assigned scope" ] }, status: :forbidden
          end
        end

        supporter = Supporter.new(public_supporter_params)
        normalized_leader_code = params[:leader_code].to_s.strip.presence
        referral_code = resolve_referral_code(normalized_leader_code)
        supporter.source = create_source
        supporter.attribution_method = create_attribution_method(normalized_leader_code)
        supporter.status = "active"
        supporter.leader_code = normalized_leader_code
        supporter.referral_code = referral_code if referral_code
        supporter.entered_by_user_id = current_user.id if staff_entry_mode? && current_user

        # Default unchecked booleans to false (checkboxes send nothing when unchecked)
        supporter.registered_voter = false if supporter.registered_voter.nil?
        supporter.yard_sign = false if supporter.yard_sign.nil?
        supporter.motorcade_available = false if supporter.motorcade_available.nil?

        # Check for duplicates
        dupes = Supporter.potential_duplicates(supporter.print_name, supporter.village_id, first_name: supporter.first_name, last_name: supporter.last_name)
        if dupes.exists?
          supporter.status = "unverified" # Flag for review
        end
        if supporter.save
          log_audit!(supporter, action: "created", changed_data: supporter.saved_changes.except("updated_at"), normalize: true, metadata: supporter_audit_metadata(supporter))

          # Queue welcome SMS so signup response is not blocked by external API latency.
          if supporter.contact_number.present? && supporter.opt_in_text
            SendSmsJob.perform_later(
              to: supporter.contact_number,
              body: SmsService.welcome_supporter_body(supporter)
            )
          end

          # Queue welcome email if supporter opted in
          if supporter.email.present? && supporter.opt_in_email
            SendWelcomeEmailJob.perform_later(supporter_id: supporter.id)
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

        supporter = scope_supporters(Supporter).find(params[:id])
        updates = supporter_update_params.to_h
        updates[:precinct_id] = nil if updates.key?(:precinct_id) && updates[:precinct_id].blank?

        if supporter.update(updates)
          changes = supporter.saved_changes.except("updated_at")
          log_audit!(supporter, action: "updated", changed_data: changes, normalize: true) if changes.present?
          CampaignBroadcast.supporter_updated(supporter, action: "updated")
          render json: { supporter: supporter_json(supporter) }
        else
          render_api_error(
            message: supporter.errors.full_messages.join(", "),
            status: :unprocessable_entity,
            code: "supporter_update_failed"
          )
        end
      end

      # PATCH /api/v1/supporters/:id/verify
      def verify
        supporter = scope_supporters(Supporter).find(params[:id])
        new_status = params[:verification_status]

        unless Supporter::VERIFICATION_STATUSES.include?(new_status)
          return render_api_error(
            message: "Invalid verification status. Must be: #{Supporter::VERIFICATION_STATUSES.join(', ')}",
            status: :unprocessable_entity,
            code: "invalid_verification_status"
          )
        end

        old_status = supporter.verification_status
        supporter.update!(
          verification_status: new_status,
          verified_by_user_id: current_user.id,
          verified_at: Time.current
        )

        log_audit!(supporter, action: "verification_changed", changed_data: {
          "verification_status" => [ old_status, new_status ],
          "verified_by" => current_user.name || current_user.email
        })
        CampaignBroadcast.supporter_updated(supporter, action: "verification_changed")

        render json: { supporter: supporter_json(supporter) }
      end

      # POST /api/v1/supporters/bulk_verify
      def bulk_verify
        ids = params[:supporter_ids]
        new_status = params[:verification_status] || "verified"

        unless ids.is_a?(Array) && ids.any?
          return render_api_error(
            message: "supporter_ids must be a non-empty array",
            status: :unprocessable_entity,
            code: "invalid_supporter_ids"
          )
        end

        unless Supporter::VERIFICATION_STATUSES.include?(new_status)
          return render_api_error(
            message: "Invalid verification status",
            status: :unprocessable_entity,
            code: "invalid_verification_status"
          )
        end

        supporters = scope_supporters(Supporter).where(id: ids)
        count = supporters.count

        # Capture old statuses before bulk update
        old_statuses = supporters.pluck(:id, :verification_status).to_h

        supporters.update_all(
          verification_status: new_status,
          verified_by_user_id: current_user.id,
          verified_at: Time.current
        )

        # Audit log for each with accurate old status
        supporters.find_each do |s|
          old_status = old_statuses[s.id] || "unknown"
          log_audit!(s, action: "verification_changed", changed_data: {
            "verification_status" => [ old_status, new_status ],
            "verified_by" => current_user.name || current_user.email
          })
        end
        CampaignBroadcast.stats_update({
          reason: "bulk_verification_changed",
          updated_count: count,
          verification_status: new_status
        })

        render json: { updated: count, verification_status: new_status }
      end

      # GET /api/v1/supporters (authenticated)
      def index
        supporters = scope_supporters(Supporter.includes(:village, :precinct, :block))

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
        supporters = supporters.where(opt_in_email: true) if params[:opt_in_email] == "true"
        supporters = supporters.where(opt_in_text: true) if params[:opt_in_text] == "true"
        supporters = supporters.where(verification_status: params[:verification_status]) if params[:verification_status].present?

        if params[:search].present?
          raw = params[:search].to_s.strip
          sanitized = ActiveRecord::Base.sanitize_sql_like(raw)
          name_query = "%#{sanitized.downcase}%"
          phone_digits = raw.gsub(/\D/, "")
          if phone_digits.present?
            phone_query = "%#{ActiveRecord::Base.sanitize_sql_like(phone_digits)}%"
            supporters = supporters.where(
              "LOWER(print_name) LIKE :name_query OR LOWER(first_name) LIKE :name_query OR LOWER(last_name) LIKE :name_query OR regexp_replace(contact_number, '\\D', '', 'g') LIKE :phone_query",
              name_query: name_query,
              phone_query: phone_query
            )
          else
            supporters = supporters.where(
              "LOWER(print_name) LIKE :q OR LOWER(first_name) LIKE :q OR LOWER(last_name) LIKE :q",
              q: name_query
            )
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
        supporter = scope_supporters(Supporter.includes(:village, :precinct, :block, event_rsvps: :event)).find(params[:id])
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
        supporters = apply_export_filters(scope_supporters(Supporter.includes(:village, :precinct).order(created_at: :desc)))
        total = supporters.count

        if total > MAX_EXPORT_ROWS
          return render_api_error(
            message: "Export too large (#{total} rows). Please add filters to export up to #{MAX_EXPORT_ROWS} rows.",
            status: :unprocessable_entity,
            code: "supporters_export_too_large",
            details: { total_rows: total, max_rows: MAX_EXPORT_ROWS }
          )
        end

        headers = [ "First Name", "Last Name", "Phone", "Village", "Precinct", "Street Address", "Email", "DOB",
                    "Registered Voter", "Yard Sign", "Motorcade Available", "Opt-In Email", "Opt-In Text",
                    "Verification Status", "Turnout Status", "Source", "Date Signed Up" ]

        rows = []
        supporters.find_each do |s|
          rows << [
            s.first_name, s.last_name, s.contact_number, s.village&.name, s.precinct&.number,
            s.street_address, s.email, s.dob&.strftime("%m/%d/%Y"),
            s.registered_voter ? "Yes" : "No",
            s.yard_sign ? "Yes" : "No",
            s.motorcade_available ? "Yes" : "No",
            s.opt_in_email ? "Yes" : "No",
            s.opt_in_text ? "Yes" : "No",
            s.verification_status&.humanize,
            s.turnout_status&.humanize,
            s.source&.humanize,
            s.created_at&.strftime("%m/%d/%Y")
          ]
        end

        format = params[:format_type] || "xlsx"
        if format == "csv"
          csv_data = CSV.generate(headers: true) do |csv|
            csv << headers
            rows.each { |r| csv << r }
          end

          send_data csv_data,
            filename: "supporters-#{Date.current.iso8601}.csv",
            type: "text/csv",
            disposition: "attachment"
        else
          package = Axlsx::Package.new
          wb = package.workbook
          wb.add_worksheet(name: "Supporters") do |sheet|
            header_style = wb.styles.add_style(b: true, bg_color: "1B3A6B", fg_color: "FFFFFF", alignment: { horizontal: :center })
            sheet.add_row headers, style: header_style
            rows.each { |r| sheet.add_row r }

            # Auto-width columns
            sheet.column_widths(*headers.map { |h| [ h.length + 4, 15 ].max })
          end

          send_data package.to_stream.read,
            filename: "supporters-#{Date.current.iso8601}.xlsx",
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            disposition: "attachment"
        end
      end

      # GET /api/v1/supporters/check_duplicate
      def check_duplicate
        name = params[:name]
        village_id = params[:village_id]
        dupes = Supporter.potential_duplicates(name, village_id, first_name: params[:first_name], last_name: params[:last_name])
        render json: { duplicates: dupes.map { |s| supporter_json(s) } }
      end

      # GET /api/v1/supporters/duplicates
      def duplicates
        scope = scope_supporters(Supporter.potential_duplicates_only.active)

        # Optional village filter
        scope = scope.where(village_id: params[:village_id]) if params[:village_id].present?

        scope = scope.includes(:village, :precinct, :duplicate_of).order(created_at: :desc)

        supporters = scope.limit(MAX_PER_PAGE)
        render json: {
          supporters: supporters.map { |s| supporter_json(s).merge(duplicate_info(s)) },
          total_count: scope.count
        }
      end

      # PATCH /api/v1/supporters/:id/resolve_duplicate
      def resolve_duplicate
        supporter = scope_supporters(Supporter).find(params[:id])
        action = params[:resolution] # "dismiss" or "merge"

        unless %w[dismiss merge].include?(action)
          return render_api_error(
            message: "resolution must be 'dismiss' or 'merge'",
            status: :unprocessable_entity,
            code: "invalid_resolution"
          )
        end

        merge_into = nil
        if action == "merge"
          merge_into = scope_supporters(Supporter).find_by(id: params[:merge_into_id])
          unless merge_into
            return render_api_error(
              message: "merge_into_id supporter not found",
              status: :not_found,
              code: "merge_target_not_found"
            )
          end
        end

        DuplicateDetector.resolve!(supporter, action: action, merge_into: merge_into, resolved_by: current_user)
        supporter.reload

        log_audit!(supporter, action: "duplicate_resolved", changed_data: {
          "resolution" => action,
          "merge_into_id" => merge_into&.id
        })
        CampaignBroadcast.supporter_updated(supporter, action: "duplicate_resolved")

        render json: { message: "Duplicate #{action == 'merge' ? 'merged' : 'dismissed'}", supporter: supporter_json(supporter.reload) }
      end

      # GET /api/v1/supporters/outreach
      def outreach
        supporters = scope_supporters(Supporter.includes(:village, :precinct))
                       .where("registered_voter IS NULL OR registered_voter = ?", false)
                       .where(status: "active")

        if params[:outreach_status].present?
          supporters = supporters.where(registration_outreach_status: params[:outreach_status])
        end

        if params[:village_id].present?
          supporters = supporters.where(village_id: params[:village_id])
        end

        if params[:search].present?
          raw = params[:search].to_s.strip
          sanitized = ActiveRecord::Base.sanitize_sql_like(raw)
          name_query = "%#{sanitized.downcase}%"
          supporters = supporters.where(
            "LOWER(print_name) LIKE :q OR LOWER(first_name) LIKE :q OR LOWER(last_name) LIKE :q",
            q: name_query
          )
        end

        supporters = supporters.order(created_at: :desc)

        page = [ (params[:page] || 1).to_i, 1 ].max
        per_page = (params[:per_page] || 50).to_i.clamp(1, MAX_PER_PAGE)
        total = supporters.count

        base_scope = scope_supporters(Supporter)
                       .where("registered_voter IS NULL OR registered_voter = ?", false)
                       .where(status: "active")
        counts = {
          total: base_scope.count,
          not_contacted: base_scope.where(registration_outreach_status: nil).count,
          contacted: base_scope.where(registration_outreach_status: "contacted").count,
          registered: base_scope.where(registration_outreach_status: "registered").count,
          declined: base_scope.where(registration_outreach_status: "declined").count
        }

        supporters = supporters.offset((page - 1) * per_page).limit(per_page)

        render json: {
          supporters: supporters.map { |s| outreach_json(s) },
          counts: counts,
          pagination: { page: page, per_page: per_page, total: total, pages: (total.to_f / per_page).ceil }
        }
      end

      # PATCH /api/v1/supporters/:id/outreach_status
      def outreach_status
        supporter = scope_supporters(Supporter).find(params[:id])
        allowed_statuses = %w[contacted registered declined]

        updates = {}
        if params[:registration_outreach_status].present?
          unless allowed_statuses.include?(params[:registration_outreach_status])
            return render_api_error(
              message: "Invalid outreach status. Must be: #{allowed_statuses.join(', ')}",
              status: :unprocessable_entity,
              code: "invalid_outreach_status"
            )
          end
          updates[:registration_outreach_status] = params[:registration_outreach_status]
          updates[:registration_outreach_date] = Time.current
          updates[:registered_voter] = true if params[:registration_outreach_status] == "registered"
        end

        updates[:registration_outreach_notes] = params[:registration_outreach_notes] if params.key?(:registration_outreach_notes)

        if supporter.update(updates)
          changes = supporter.saved_changes.except("updated_at")
          log_audit!(supporter, action: "outreach_updated", changed_data: changes, normalize: true) if changes.present?
          render json: { supporter: outreach_json(supporter) }
        else
          render_api_error(
            message: supporter.errors.full_messages.join(", "),
            status: :unprocessable_entity,
            code: "outreach_update_failed"
          )
        end
      end

      # POST /api/v1/supporters/scan_duplicates
      def scan_duplicates
        count = DuplicateDetector.scan_all!
        render json: { message: "Scan complete", flagged_count: count }
      end

      private

      def apply_export_filters(supporters)
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
        supporters = supporters.where(opt_in_email: true) if params[:opt_in_email] == "true"
        supporters = supporters.where(opt_in_text: true) if params[:opt_in_text] == "true"
        supporters = supporters.where(verification_status: params[:verification_status]) if params[:verification_status].present?

        if params[:search].present?
          raw = params[:search].to_s.strip
          sanitized = ActiveRecord::Base.sanitize_sql_like(raw)
          name_query = "%#{sanitized.downcase}%"
          phone_digits = raw.gsub(/\D/, "")
          if phone_digits.present?
            phone_query = "%#{ActiveRecord::Base.sanitize_sql_like(phone_digits)}%"
            supporters = supporters.where(
              "LOWER(print_name) LIKE :name_query OR LOWER(first_name) LIKE :name_query OR LOWER(last_name) LIKE :name_query OR regexp_replace(contact_number, '\\D', '', 'g') LIKE :phone_query",
              name_query: name_query,
              phone_query: phone_query
            )
          else
            supporters = supporters.where(
              "LOWER(print_name) LIKE :q OR LOWER(first_name) LIKE :q OR LOWER(last_name) LIKE :q",
              q: name_query
            )
          end
        end

        apply_index_sort(supporters)
      end

      def public_supporter_params
        params.require(:supporter).permit(
          :first_name, :last_name, :print_name, :contact_number, :dob, :email, :street_address,
          :village_id, :precinct_id, :registered_voter,
          :yard_sign, :motorcade_available,
          :opt_in_email, :opt_in_text
        )
      end

      def supporter_update_params
        params.require(:supporter).permit(
          :first_name, :last_name, :print_name, :contact_number, :email, :dob, :street_address,
          :village_id, :precinct_id, :registered_voter, :yard_sign, :motorcade_available,
          :opt_in_email, :opt_in_text, :status
        )
      end

      def create_source
        return "qr_signup" if params[:leader_code].to_s.strip.present?
        return "staff_entry" if staff_entry_mode?

        # Public signup without a leader/referral code.
        "public_signup"
      end

      def create_attribution_method(normalized_leader_code)
        return "qr_self_signup" if normalized_leader_code.present?
        return params[:entry_channel] == "scan" ? "staff_scan" : "staff_manual" if staff_entry_mode?

        "public_signup"
      end

      def staff_entry_mode?
        params[:entry_mode] == "staff"
      end

      def supporter_json(supporter)
        {
          id: supporter.id,
          first_name: supporter.first_name,
          last_name: supporter.last_name,
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
          opt_in_email: supporter.opt_in_email,
          opt_in_text: supporter.opt_in_text,
          verification_status: supporter.verification_status,
          verified_at: supporter.verified_at&.iso8601,
          verified_by_user_id: supporter.verified_by_user_id,
          source: supporter.source,
          status: supporter.status,
          leader_code: supporter.leader_code,
          attribution_method: supporter.attribution_method,
          referral_code_id: supporter.referral_code_id,
          referral_display_name: supporter.referral_code&.display_name,
          reliability_score: supporter.reliability_score,
          potential_duplicate: supporter.potential_duplicate,
          duplicate_of_id: supporter.duplicate_of_id,
          duplicate_notes: supporter.duplicate_notes,
          registration_outreach_status: supporter.registration_outreach_status,
          registration_outreach_notes: supporter.registration_outreach_notes,
          registration_outreach_date: supporter.registration_outreach_date&.iso8601,
          created_at: supporter.created_at&.iso8601
        }
      end

      def outreach_json(supporter)
        {
          id: supporter.id,
          first_name: supporter.first_name,
          last_name: supporter.last_name,
          print_name: supporter.print_name,
          contact_number: supporter.contact_number,
          email: supporter.email,
          village_id: supporter.village_id,
          village_name: supporter.village&.name,
          precinct_number: supporter.precinct&.number,
          registered_voter: supporter.registered_voter,
          registration_outreach_status: supporter.registration_outreach_status,
          registration_outreach_notes: supporter.registration_outreach_notes,
          registration_outreach_date: supporter.registration_outreach_date&.iso8601,
          status: supporter.status,
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

      def duplicate_info(supporter)
        info = {}
        if supporter.duplicate_of_id.present? && supporter.association(:duplicate_of).loaded?
          orig = supporter.duplicate_of
          info[:duplicate_of] = orig ? { id: orig.id, name: orig.display_name, contact_number: orig.contact_number } : nil
        end
        info
      end

      def audit_entry_mode
        params[:entry_mode]
      end

      def supporter_audit_metadata(supporter)
        { leader_code: params[:leader_code], referral_code_id: supporter.referral_code_id }.compact
      end

      def resolve_referral_code(code)
        normalized = code.to_s.strip
        return nil if normalized.blank?

        ReferralCode.find_by(code: normalized)
      end

      def supporter_edit_allowed?
        current_user&.admin? || current_user&.coordinator?
      end

      # Alias for backward compatibility with callers
      def normalized_changed_data(changed_data)
        normalize_changed_data(changed_data)
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
