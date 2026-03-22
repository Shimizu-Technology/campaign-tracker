# frozen_string_literal: true

require "csv"
require "set"

module Api
  module V1
    class SupportersController < ApplicationController
      MAX_PER_PAGE = 200
      MAX_EXPORT_ROWS = 10_000
      ALLOWED_SORT_FIELDS = %w[created_at print_name last_name first_name village_name precinct_number source registered_voter].freeze

      include Authenticatable
      include AuditLoggable
      before_action :authenticate_request, only: [ :index, :check_duplicate, :export, :show, :update, :verify, :bulk_verify, :duplicates, :resolve_duplicate, :scan_duplicates, :outreach, :outreach_status, :public_review, :accept_to_quota, :reject_public_review, :vetting_queue, :approve_supporter, :reject_supporter ]
      before_action :require_supporter_access!, only: [ :index, :check_duplicate, :export, :show, :outreach, :outreach_status ]
      before_action :require_data_ops_access!, only: [ :duplicates, :resolve_duplicate, :scan_duplicates, :public_review, :accept_to_quota, :reject_public_review, :vetting_queue, :approve_supporter, :reject_supporter ]
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

        normalized_leader_code = params[:leader_code].to_s.strip.presence
        referral_code = resolve_referral_code(normalized_leader_code)
        supporters, duplicate_detected = create_supporters_from_signup!(
          normalized_public_supporter_params,
          normalized_leader_code: normalized_leader_code,
          referral_code: referral_code
        )
        primary_supporter = supporters.first
        text_destinations = Set.new
        email_destinations = Set.new

        supporters.each do |supporter|
          log_audit!(supporter, action: "created", changed_data: supporter.saved_changes.except("updated_at"), normalize: true, metadata: supporter_audit_metadata(supporter))
          deliver_signup_communications!(supporter, text_destinations: text_destinations, email_destinations: email_destinations)
          supporter.reload
          CampaignBroadcast.new_supporter(supporter)
        end

        render json: {
          message: supporters.size > 1 ? "Si Yu'os Ma'åse! Your household supporters were received." : "Si Yu'os Ma'åse! Thank you for supporting Josh & Tina!",
          supporter: supporter_json(primary_supporter.reload),
          household_created_count: supporters.size,
          household_members: supporters.drop(1).map { |supporter| supporter_json(supporter) },
          duplicate_warning: duplicate_detected || supporters.any?(&:potential_duplicate)
        }, status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
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
        updates = normalized_supporter_update_params
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
        supporter = scope_supporters(Supporter.includes(:referred_from_village)).find(params[:id])
        new_status = params[:verification_status]

        unless Supporter::VERIFICATION_STATUSES.include?(new_status)
          return render_api_error(
            message: "Invalid verification status. Must be: #{Supporter::VERIFICATION_STATUSES.join(', ')}",
            status: :unprocessable_entity,
            code: "invalid_verification_status"
          )
        end

        match_payload = new_status == "verified" ? verification_match_payload(supporter) : nil

        if new_status == "verified"
          matches = match_payload&.fetch(:matches, []) || []
          if matches.none?
            return render_api_error(
              message: "Supporter cannot be marked as a verified voter without a current GEC match.",
              status: :unprocessable_entity,
              code: "gec_match_required_for_verified"
            )
          end
        end

        old_status = supporter.verification_status
        supporter.update!(verification_update_attributes(supporter, new_status, match_payload: match_payload))

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

        supporters = scope_supporters(Supporter).where(id: ids).to_a
        count = supporters.size

        match_payloads = {}

        if new_status == "verified"
          supporters.each do |supporter|
            match_payloads[supporter.id] = verification_match_payload(supporter)
          end

          invalid_supporters = supporters.reject { |supporter| match_payloads.dig(supporter.id, :matches)&.any? }
          if invalid_supporters.any?
            return render_api_error(
              message: "One or more supporters cannot be marked as verified voters without a current GEC match.",
              status: :unprocessable_entity,
              code: "gec_match_required_for_verified"
            )
          end
        end

        # Capture old statuses before bulk update
        old_statuses = supporters.to_h { |supporter| [ supporter.id, supporter.verification_status ] }

        supporters.each do |supporter|
          supporter.update_columns(
            verification_update_attributes(
              supporter,
              new_status,
              match_payload: match_payloads[supporter.id]
            )
          )
        end

        # Audit log for each with accurate old status
        supporters.each do |s|
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
        supporters = scope_supporters(Supporter.includes(:village, :precinct, :block, :referred_from_village).official_supporters)

        # Filters
        supporters = supporters.where(village_id: params[:village_id]) if params[:village_id].present?
        if params[:unassigned_precinct] == "true"
          supporters = supporters.where(precinct_id: nil)
        elsif params[:precinct_id].present?
          supporters = supporters.where(precinct_id: params[:precinct_id])
        end
        supporters = supporters.where(status: params[:status]) if params[:status].present?
        supporters = supporters.where(source: params[:source]) if params[:source].present?
        supporters = supporters.where(review_status: params[:review_status]) if params[:review_status].present?
        supporters = supporters.where(public_review_status: params[:public_review_status]) if params[:public_review_status].present?
        supporters = supporters.where(registered_voter: true) if params[:registered_voter] == "true"
        # Pipeline filter: team input, public-origin official supporters, or
        # matched-to-GEC supporters for legacy quota views.
        supporters = supporters.team_input if params[:pipeline] == "team"
        supporters = supporters.public_origin if params[:pipeline] == "public"
        supporters = supporters.quota_eligible if params[:pipeline] == "quota"
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

        legacy_flagged_supporters = supporters.select do |supporter|
          supporter.verification_status == "flagged" &&
            supporter.verification_reason.blank? &&
            supporter.referred_from_village_id.blank?
        end
        legacy_matches = GecVoter.find_matches_for_supporters(legacy_flagged_supporters)

        verification_reason_overrides = legacy_flagged_supporters.each_with_object({}) do |supporter, memo|
          memo[supporter.id] = SupporterVerificationReasonService.new(
            supporter,
            matches: legacy_matches[supporter.id] || []
          ).payload || {}
        end

        render json: {
          supporters: supporters.map { |s| supporter_json(s, reason_payload: verification_reason_overrides[s.id]) },
          pagination: { page: page, per_page: per_page, total: total, pages: (total.to_f / per_page).ceil }
        }
      end

      # GET /api/v1/supporters/:id
      def show
        supporter = scope_supporters(
          Supporter.includes(:village, :precinct, :block, :referred_from_village, :registration_outreach_updated_by_user, household_group: :supporters, event_rsvps: :event)
        ).find(params[:id])
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
        supporters = apply_export_filters(scope_supporters(Supporter.includes(:village, :precinct).official_supporters.order(created_at: :desc)))
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
        merge_target_snapshot = nil

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
          merge_target_snapshot = merge_into.attributes.slice(*duplicate_merge_audit_fields)
        end

        DuplicateDetector.resolve!(supporter, action: action, merge_into: merge_into, resolved_by: current_user)
        supporter.reload
        merge_into.reload if merge_into

        log_audit!(supporter, action: "duplicate_resolved", changed_data: {
          "resolution" => action,
          "merge_into_id" => merge_into&.id
        }, normalize: true)
        if action == "merge" && merge_into
          kept_record_changes = { "merged_supporter_id" => supporter.id }
          duplicate_merge_audit_fields.each do |field|
            before_value = merge_target_snapshot[field]
            after_value = merge_into.public_send(field)
            next if before_value == after_value

            kept_record_changes[field] = [ before_value, after_value ]
          end

          log_audit!(merge_into, action: "duplicate_merged", changed_data: kept_record_changes, normalize: true)
          CampaignBroadcast.supporter_updated(merge_into, action: "duplicate_merged")
        end
        CampaignBroadcast.supporter_updated(supporter, action: "duplicate_resolved")

        render json: { message: "Duplicate #{action == 'merge' ? 'merged' : 'dismissed'}", supporter: supporter_json(supporter.reload) }
      end

      # GET /api/v1/supporters/outreach
      def outreach
        supporters = outreach_scope

        if params[:outreach_status].present?
          supporters = supporters.where(registration_outreach_status: params[:outreach_status])
        end

        if params[:followup_reason].present?
          supporters = case params[:followup_reason]
          when "no_gec_match"
            supporters.where(verification_reason: "no_gec_match")
          when "registration_help"
            supporters.where(needs_voter_registration_help: true)
          when "ride"
            supporters.where(needs_election_day_ride: true)
          when "absentee"
            supporters.where(needs_absentee_ballot_help: true)
          when "homebound"
            supporters.where(needs_homebound_voting_help: true)
          when "campaign"
            supporters.where(wants_to_volunteer: true)
          else
            supporters
          end
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

        base_scope = outreach_scope
        counts = {
          total: base_scope.count,
          not_contacted: base_scope.where(registration_outreach_status: nil).count,
          contacted: base_scope.where(registration_outreach_status: "contacted").count,
          registered: base_scope.where(registration_outreach_status: "registered").count,
          declined: base_scope.where(registration_outreach_status: "declined").count,
          no_gec_match: base_scope.where(verification_reason: "no_gec_match").count,
          registration_help: base_scope.where(needs_voter_registration_help: true).count,
          absentee_help: base_scope.where(needs_absentee_ballot_help: true).count,
          homebound_help: base_scope.where(needs_homebound_voting_help: true).count,
          ride_help: base_scope.where(needs_election_day_ride: true).count
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
          updates[:registration_outreach_updated_by_user_id] = current_user.id if current_user
          if params[:registration_outreach_status] == "registered"
            updates[:registered_voter] = true
            updates[:self_reported_registered_voter] = true
            updates[:self_reported_registered_voter_status] = "yes"
            updates[:needs_voter_registration_help] = false
          end
        end

        if params.key?(:registration_outreach_notes)
          updates[:registration_outreach_notes] = params[:registration_outreach_notes]
          updates[:registration_outreach_updated_by_user_id] = current_user.id if current_user
        end

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

      # GET /api/v1/supporters/public_review
      # List self-submitted public signups waiting for intake review.
      def public_review
        supporters = public_review_scope

        supporters = supporters.where(village_id: params[:village_id]) if params[:village_id].present?

        if params[:search].present?
          sanitized = ActiveRecord::Base.sanitize_sql_like(params[:search].to_s.strip)
          supporters = supporters.where(
            "LOWER(first_name) LIKE :q OR LOWER(last_name) LIKE :q",
            q: "%#{sanitized.downcase}%"
          )
        end

        supporters = supporters.order(created_at: :desc)

        page = [ (params[:page] || 1).to_i, 1 ].max
        per_page = (params[:per_page] || 50).to_i.clamp(1, MAX_PER_PAGE)
        total = supporters.count
        supporters = supporters.offset((page - 1) * per_page).limit(per_page)

        summary_base = scope_supporters(Supporter.active)
        summary_base = summary_base.where(village_id: params[:village_id]) if params[:village_id].present?
        if params[:search].present?
          sanitized = ActiveRecord::Base.sanitize_sql_like(params[:search].to_s.strip)
          summary_base = summary_base.where(
            "LOWER(first_name) LIKE :q OR LOWER(last_name) LIKE :q",
            q: "%#{sanitized.downcase}%"
          )
        end
        pending_review_count = summary_base.public_signups.count
        accepted_count = summary_base.accepted_public_signups.count
        rejected_count = summary_base.public_review_rejected.count

        render json: {
          supporters: supporters.map { |s| supporter_json(s) },
          summary: {
            pending_review: pending_review_count,
            approved_for_supporter_review: accepted_count,
            accepted: accepted_count,
            rejected: rejected_count,
            total_public: pending_review_count + accepted_count + rejected_count
          },
          current_bucket: public_review_bucket,
          pagination: { page: page, per_page: per_page, total: total, pages: (total.to_f / per_page).ceil }
        }
      end

      # PATCH /api/v1/supporters/:id/accept_to_quota
      # Approve a public submission into the main supporter review queue.
      def accept_to_quota
        supporter = scope_supporters(Supporter).find(params[:id])

        unless supporter.public_review_status == "pending" && Supporter::PUBLIC_SOURCES.include?(supporter.source)
          return render_api_error(
            message: "Public submission has already been reviewed",
            status: :unprocessable_entity,
            code: "public_submission_already_reviewed"
          )
        end

        old_public_review_status = supporter.public_review_status
        supporter.update!(
          intake_status: "accepted",
          public_review_status: "approved",
          public_reviewed_at: Time.current,
          public_reviewed_by_user_id: current_user.id,
          review_status: "pending",
          reviewed_at: nil,
          reviewed_by_user_id: nil
        )

        log_audit!(supporter, action: "accepted_to_quota", changed_data: {
          "public_review_status" => [ old_public_review_status, "approved" ]
        }, normalize: true)

        CampaignBroadcast.supporter_updated(supporter, action: "public_review_approved")
        render json: { supporter: supporter_json(supporter), message: "Public submission approved and sent to supporter review" }
      end

      # PATCH /api/v1/supporters/:id/reject_public_review
      def reject_public_review
        supporter = scope_supporters(Supporter).find(params[:id])

        unless supporter.public_review_status == "pending" && Supporter::PUBLIC_SOURCES.include?(supporter.source)
          return render_api_error(
            message: "Public submission has already been reviewed",
            status: :unprocessable_entity,
            code: "public_submission_already_reviewed"
          )
        end

        supporter.update!(
          public_review_status: "rejected",
          public_reviewed_at: Time.current,
          public_reviewed_by_user_id: current_user.id,
          review_status: "rejected",
          reviewed_at: Time.current,
          reviewed_by_user_id: current_user.id
        )
        DuplicateDetector.remove_candidate!(supporter)
        supporter.reload

        log_audit!(supporter, action: "public_review_rejected", changed_data: {
          "public_review_status" => [ "pending", "rejected" ],
          "review_status" => [ "pending", "rejected" ]
        }, normalize: true)

        CampaignBroadcast.supporter_updated(supporter, action: "public_review_rejected")
        render json: { supporter: supporter_json(supporter), message: "Public submission rejected" }
      end

      # PATCH /api/v1/supporters/:id/approve_supporter
      def approve_supporter
        supporter = scope_supporters(Supporter).find(params[:id])

        unless supporter.review_status == "pending" && supporter.public_review_status != "pending"
          return render_api_error(
            message: "Supporter submission is not ready for approval",
            status: :unprocessable_entity,
            code: "supporter_review_not_pending"
          )
        end

        if supporter.potential_duplicate?
          return render_api_error(
            message: "Supporter has an unresolved duplicate warning",
            status: :unprocessable_entity,
            code: "duplicate_review_required"
          )
        end

        supporter.update!(
          review_status: "approved",
          reviewed_at: Time.current,
          reviewed_by_user_id: current_user.id,
          quota_period_id: current_quota_period_id_for_approval
        )

        log_audit!(supporter, action: "supporter_review_approved", changed_data: {
          "review_status" => [ "pending", "approved" ]
        }, normalize: true)
        CampaignBroadcast.supporter_updated(supporter, action: "supporter_review_approved")

        render json: { supporter: supporter_json(supporter), message: "Supporter approved into the official supporter list" }
      end

      # PATCH /api/v1/supporters/:id/reject_supporter
      def reject_supporter
        supporter = scope_supporters(Supporter).find(params[:id])

        unless supporter.review_status == "pending" && supporter.public_review_status != "pending"
          return render_api_error(
            message: "Supporter submission is not ready for rejection",
            status: :unprocessable_entity,
            code: "supporter_review_not_pending"
          )
        end

        supporter.update!(
          review_status: "rejected",
          reviewed_at: Time.current,
          reviewed_by_user_id: current_user.id
        )
        DuplicateDetector.remove_candidate!(supporter)
        supporter.reload

        log_audit!(supporter, action: "supporter_review_rejected", changed_data: {
          "review_status" => [ "pending", "rejected" ]
        }, normalize: true)
        CampaignBroadcast.supporter_updated(supporter, action: "supporter_review_rejected")

        render json: { supporter: supporter_json(supporter), message: "Supporter submission rejected" }
      end

      # GET /api/v1/supporters/vetting_queue
      # Pending supporter submissions awaiting data-team approval.
      def vetting_queue
        base = scope_supporters(Supporter.includes(:village, :precinct, :entered_by))
                 .pending_supporter_review
        if params[:district_id].present?
          base = base.joins(:village).where(villages: { district_id: params[:district_id] })
        end
        base = base.where(village_id: params[:village_id]) if params[:village_id].present?
        base = base.where(precinct_id: params[:precinct_id]) if params[:precinct_id].present?
        if params[:source_group] == "team"
          base = base.where(source: Supporter::TEAM_SOURCES)
        elsif params[:source].present?
          base = base.where(source: params[:source])
        end

        if params[:search].present?
          sanitized = ActiveRecord::Base.sanitize_sql_like(params[:search].to_s.strip)
          base = base.where(
            "LOWER(first_name) LIKE :q OR LOWER(last_name) LIKE :q",
            q: "%#{sanitized.downcase}%"
          )
        end

        scope = case params[:filter]
        when "verified"
          base.verified
        when "flagged"
          base.flagged.where(referred_from_village_id: nil)
        when "no_match", "unregistered"
          base.unverified.where(registered_voter: false)
        when "referral"
          base.where.not(referred_from_village_id: nil)
        else
          base
        end

        scope = scope.order(created_at: :desc)

        page = [ (params[:page] || 1).to_i, 1 ].max
        per_page = (params[:per_page] || 50).to_i.clamp(1, MAX_PER_PAGE)
        total = scope.count
        supporters = scope.offset((page - 1) * per_page).limit(per_page)

        # GEC match lookup per supporter — O(n) queries where n = supporters per page (max 50).
        # Each lookup uses compound indexes on (lower(first_name), lower(last_name), dob)
        # and cascading match strategies that are hard to batch. With indexed queries and
        # capped page size, this stays well under 100ms total.
        gec_matches = {}
        verification_reasons = {}
        supporters.each do |s|
          matches = GecVoter.find_matches(
            first_name: s.first_name,
            last_name: s.last_name,
            dob: s.dob,
            village_name: s.village&.name
          )
          verification_reasons[s.id] = SupporterVerificationReasonService.new(s, matches: matches).payload || {}
          gec_matches[s.id] = matches.first(3).map do |m|
            {
              gec_voter: m[:gec_voter].as_json(only: [ :id, :first_name, :last_name, :dob, :village_name, :voter_registration_number ]),
              confidence: m[:confidence],
              match_type: m[:match_type]
            }
          end
        end

        # Summary counts within the currently selected structural filters
        summary = {
          total_pending_review: base.count,
          total_needing_review: base.count,
          verified: base.verified.count,
          flagged: base.flagged.where(referred_from_village_id: nil).count,
          unverified: base.unverified.where(registered_voter: false).count,
          no_match: base.unverified.where(registered_voter: false).count,
          unregistered: base.unverified.where(registered_voter: false).count,
          referrals: base.where.not(referred_from_village_id: nil).count
        }

        render json: {
          supporters: supporters.map do |s|
            supporter_json(s, reason_payload: verification_reasons[s.id]).merge(
              gec_matches: gec_matches[s.id] || []
            )
          end,
          summary: summary,
          pagination: { page: page, per_page: per_page, total: total, pages: (total.to_f / per_page).ceil }
        }
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
        supporters = supporters.where(review_status: params[:review_status]) if params[:review_status].present?
        supporters = supporters.where(public_review_status: params[:public_review_status]) if params[:public_review_status].present?
        supporters = supporters.where(registered_voter: true) if params[:registered_voter] == "true"
        # Pipeline filter: team input, public-origin official supporters, or
        # matched-to-GEC supporters for legacy quota views.
        supporters = supporters.team_input if params[:pipeline] == "team"
        supporters = supporters.public_origin if params[:pipeline] == "public"
        supporters = supporters.quota_eligible if params[:pipeline] == "quota"
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
          :first_name, :middle_name, :last_name, :print_name, :contact_number, :dob, :email, :street_address,
          :village_id, :precinct_id, :registered_voter, :self_reported_registered_voter,
          :self_reported_registered_voter_status, :self_reported_voting_location,
          :yard_sign, :motorcade_available, :wants_to_volunteer,
          :needs_absentee_ballot_help, :needs_homebound_voting_help, :needs_voter_registration_help, :needs_election_day_ride,
          :referred_by_name,
          :opt_in_email, :opt_in_text,
          household_members: [
            :first_name, :middle_name, :last_name, :print_name, :contact_number, :dob, :email, :street_address,
            :village_id, :precinct_id, :registered_voter, :self_reported_registered_voter,
            :self_reported_registered_voter_status, :self_reported_voting_location,
            :yard_sign, :motorcade_available, :wants_to_volunteer,
            :needs_absentee_ballot_help, :needs_homebound_voting_help, :needs_voter_registration_help, :needs_election_day_ride,
            :referred_by_name, :opt_in_email, :opt_in_text
          ]
        )
      end

      def supporter_update_params
        params.require(:supporter).permit(
          :first_name, :middle_name, :last_name, :print_name, :contact_number, :email, :dob, :street_address,
          :village_id, :precinct_id, :registered_voter, :self_reported_registered_voter,
          :self_reported_registered_voter_status, :self_reported_voting_location,
          :yard_sign, :motorcade_available, :wants_to_volunteer,
          :needs_absentee_ballot_help, :needs_homebound_voting_help, :needs_voter_registration_help, :needs_election_day_ride,
          :referred_by_name,
          :opt_in_email, :opt_in_text, :status
        )
      end

      def normalized_public_supporter_params
        normalize_self_reported_registered_voter(public_supporter_params.to_h)
      end

      def normalized_supporter_update_params
        normalize_self_reported_registered_voter(supporter_update_params.to_h)
      end

      def normalize_self_reported_registered_voter(attributes)
        had_household_members = attributes.key?("household_members")
        household_members = Array(attributes.delete("household_members"))

        if !attributes.key?("self_reported_registered_voter") && attributes.key?("registered_voter")
          attributes["self_reported_registered_voter"] = attributes["registered_voter"]
        end

        if !attributes.key?("self_reported_registered_voter_status") && attributes.key?("self_reported_registered_voter")
          attributes["self_reported_registered_voter_status"] =
            case attributes["self_reported_registered_voter"]
            when true, "true", 1, "1" then "yes"
            when false, "false", 0, "0" then "no"
            else nil
            end
        end

        if attributes["self_reported_registered_voter_status"] == "yes" && !attributes.key?("self_reported_registered_voter")
          attributes["self_reported_registered_voter"] = true
        elsif %w[no not_sure].include?(attributes["self_reported_registered_voter_status"]) && !attributes.key?("self_reported_registered_voter")
          attributes["self_reported_registered_voter"] = attributes["self_reported_registered_voter_status"] == "no" ? false : nil
        end

        attributes["self_reported_voting_location"] = nil unless attributes["self_reported_registered_voter_status"] == "yes"
        attributes["referred_by_name"] = nil if params[:leader_code].to_s.strip.present?

        if had_household_members
          attributes["household_members"] = household_members.map do |member|
            normalize_self_reported_registered_voter(member.to_h)
          end
        end

        attributes
      end

      def create_supporters_from_signup!(attributes, normalized_leader_code:, referral_code:)
        primary_attributes = attributes.except("household_members")
        household_member_attributes = Array(attributes["household_members"]).reject { |member| member["first_name"].blank? || member["last_name"].blank? }
        created_supporters = []
        duplicate_detected = false

        Supporter.transaction do
          household_group = build_household_group(primary_attributes, household_member_attributes)

          primary_supporter = build_signup_supporter(
            primary_attributes,
            normalized_leader_code: normalized_leader_code,
            referral_code: referral_code,
            household_group: household_group
          )
          duplicate_detected ||= duplicate_detected_for?(primary_supporter)
          primary_supporter.save!
          created_supporters << primary_supporter

          household_group&.update!(
            village_id: primary_supporter.village_id,
            primary_contact_number: primary_supporter.contact_number,
            primary_email: primary_supporter.email,
            street_address: primary_supporter.street_address
          )

          household_member_attributes.each do |member_attributes|
            household_supporter = build_household_signup_supporter(
              member_attributes,
              primary_supporter: primary_supporter,
              normalized_leader_code: normalized_leader_code,
              referral_code: referral_code,
              household_group: household_group
            )
            duplicate_detected ||= duplicate_detected_for?(household_supporter)
            household_supporter.save!
            created_supporters << household_supporter
          end
        end

        [ created_supporters, duplicate_detected ]
      end

      def build_signup_supporter(attributes, normalized_leader_code:, referral_code:, household_group: nil)
        supporter = Supporter.new(attributes.except("household_members"))
        source = create_source
        supporter.source = source
        supporter.attribution_method = create_attribution_method(normalized_leader_code)
        supporter.intake_status = create_intake_status(source)
        supporter.review_status = "pending"
        supporter.public_review_status = create_public_review_status(source)
        supporter.status = "active"
        supporter.leader_code = normalized_leader_code
        supporter.referral_code = referral_code if referral_code
        supporter.referred_by_name = nil if referral_code
        supporter.household_group = household_group if household_group
        supporter.entered_by_user_id = current_user.id if staff_entry_mode? && current_user
        apply_signup_defaults!(supporter)
        supporter
      end

      def build_household_signup_supporter(attributes, primary_supporter:, normalized_leader_code:, referral_code:, household_group:)
        member_overrides = attributes.reject do |_, value|
          value.nil? || (value.respond_to?(:empty?) && value.empty?)
        end

        merged_attributes = primary_supporter.attributes.slice(
          "contact_number",
          "email",
          "street_address",
          "village_id",
          "yard_sign",
          "motorcade_available",
          "opt_in_email",
          "opt_in_text",
          "wants_to_volunteer",
          "needs_absentee_ballot_help",
          "needs_homebound_voting_help",
          "needs_voter_registration_help",
          "needs_election_day_ride",
          "referred_by_name"
        ).merge(member_overrides)

        build_signup_supporter(
          merged_attributes,
          normalized_leader_code: normalized_leader_code,
          referral_code: referral_code,
          household_group: household_group
        )
      end

      def build_household_group(primary_attributes, household_member_attributes)
        return nil if household_member_attributes.empty?

        HouseholdGroup.create!(
          village_id: primary_attributes["village_id"],
          primary_contact_number: primary_attributes["contact_number"],
          primary_email: primary_attributes["email"],
          street_address: primary_attributes["street_address"]
        )
      end

      def apply_signup_defaults!(supporter)
        supporter.registered_voter = false if supporter.registered_voter.nil?
        supporter.yard_sign = false if supporter.yard_sign.nil?
        supporter.motorcade_available = false if supporter.motorcade_available.nil?
        supporter.opt_in_email = false if supporter.opt_in_email.nil?
        supporter.opt_in_text = false if supporter.opt_in_text.nil?
        supporter.wants_to_volunteer = false if supporter.wants_to_volunteer.nil?
        supporter.needs_absentee_ballot_help = false if supporter.needs_absentee_ballot_help.nil?
        supporter.needs_homebound_voting_help = false if supporter.needs_homebound_voting_help.nil?
        supporter.needs_voter_registration_help = false if supporter.needs_voter_registration_help.nil?
        supporter.needs_election_day_ride = false if supporter.needs_election_day_ride.nil?
      end

      def duplicate_detected_for?(supporter)
        Supporter.potential_duplicates(
          supporter.print_name,
          supporter.village_id,
          first_name: supporter.first_name,
          last_name: supporter.last_name
        ).exists?
      end

      def deliver_signup_communications!(supporter, text_destinations:, email_destinations:)
        normalized_phone = Supporter.normalize_phone(supporter.contact_number)
        if supporter.contact_number.present? && supporter.opt_in_text && !text_destinations.include?(normalized_phone)
          SendSmsJob.perform_later(
            to: supporter.contact_number,
            body: SmsService.welcome_supporter_body(supporter)
          )
          text_destinations << normalized_phone
        end

        normalized_email = supporter.email.to_s.strip.downcase
        return unless supporter.email.present? && supporter.opt_in_email && !email_destinations.include?(normalized_email)

        SendWelcomeEmailJob.perform_later(supporter_id: supporter.id)
        email_destinations << normalized_email
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

      def create_intake_status(source)
        Supporter::PUBLIC_SOURCES.include?(source) ? "pending_public_review" : "accepted"
      end

      def create_public_review_status(source)
        Supporter::PUBLIC_SOURCES.include?(source) ? "pending" : "not_applicable"
      end

      def public_review_bucket
        bucket = params[:review_bucket].to_s.presence || "pending"
        %w[pending approved rejected].include?(bucket) ? bucket : "pending"
      end

      def public_review_scope
        base = scope_supporters(Supporter.includes(:village, :precinct)).active

        case public_review_bucket
        when "approved"
          base.public_review_approved
        when "rejected"
          base.public_review_rejected
        else
          base.pending_public_review
        end
      end

      def outreach_scope
        scope_supporters(Supporter.includes(:village, :precinct, :registration_outreach_updated_by_user))
          .active
          .where.not(review_status: "rejected")
          .where.not(public_review_status: "rejected")
          .where(
            "supporters.registered_voter = ? OR supporters.needs_voter_registration_help = ? OR supporters.needs_absentee_ballot_help = ? OR supporters.needs_homebound_voting_help = ? OR supporters.needs_election_day_ride = ? OR supporters.verification_reason = ? OR supporters.self_reported_registered_voter_status IN (?)",
            false,
            true,
            true,
            true,
            true,
            "no_gec_match",
            %w[no not_sure]
          )
      end

      def staff_entry_mode?
        params[:entry_mode] == "staff"
      end

      def supporter_json(supporter, reason_payload: nil)
        reason_payload ||= SupporterVerificationReasonService.new(supporter).payload || {}

        {
          id: supporter.id,
          first_name: supporter.first_name,
          middle_name: supporter.middle_name,
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
          self_reported_registered_voter: supporter.self_reported_registered_voter,
          self_reported_registered_voter_status: supporter.self_reported_registered_voter_status,
          self_reported_voting_location: supporter.self_reported_voting_location,
          registered_voter: supporter.registered_voter,
          yard_sign: supporter.yard_sign,
          motorcade_available: supporter.motorcade_available,
          wants_to_volunteer: supporter.wants_to_volunteer,
          needs_absentee_ballot_help: supporter.needs_absentee_ballot_help,
          needs_homebound_voting_help: supporter.needs_homebound_voting_help,
          needs_voter_registration_help: supporter.needs_voter_registration_help,
          needs_election_day_ride: supporter.needs_election_day_ride,
          campaign_help_requests: supporter.campaign_help_requests,
          opt_in_email: supporter.opt_in_email,
          opt_in_text: supporter.opt_in_text,
          verification_status: supporter.verification_status,
          verified_at: supporter.verified_at&.iso8601,
          verified_by_user_id: supporter.verified_by_user_id,
          source: supporter.source,
          intake_status: supporter.intake_status,
          review_status: supporter.review_status,
          public_review_status: supporter.public_review_status,
          quota_period_id: supporter.quota_period_id,
          reviewed_at: supporter.reviewed_at&.iso8601,
          reviewed_by_user_id: supporter.reviewed_by_user_id,
          public_reviewed_at: supporter.public_reviewed_at&.iso8601,
          public_reviewed_by_user_id: supporter.public_reviewed_by_user_id,
          status: supporter.status,
          leader_code: supporter.leader_code,
          attribution_method: supporter.attribution_method,
          referral_code_id: supporter.referral_code_id,
          referral_display_name: supporter.referral_code&.display_name,
          referred_by_name: supporter.referred_by_name,
          referred_from_village_id: supporter.referred_from_village_id,
          referred_from_village_name: supporter.referred_from_village&.name,
          verification_reason: reason_payload[:verification_reason],
          verification_reason_label: reason_payload[:verification_reason_label],
          verification_reason_detail: reason_payload[:verification_reason_detail],
          verification_reason_metadata: reason_payload[:verification_reason_metadata],
          verification_reason_derived: reason_payload[:verification_reason_derived],
          reliability_score: supporter.reliability_score,
          potential_duplicate: supporter.potential_duplicate,
          duplicate_of_id: supporter.duplicate_of_id,
          duplicate_notes: supporter.duplicate_notes,
          household_group_id: supporter.household_group_id,
          registration_outreach_status: supporter.registration_outreach_status,
          registration_outreach_notes: supporter.registration_outreach_notes,
          registration_outreach_date: supporter.registration_outreach_date&.iso8601,
          registration_outreach_updated_by_user_id: supporter.registration_outreach_updated_by_user_id,
          registration_outreach_updated_by_user_name: supporter.registration_outreach_updated_by_user&.name,
          created_at: supporter.created_at&.iso8601
        }
      end

      def outreach_json(supporter)
        {
          id: supporter.id,
          first_name: supporter.first_name,
          middle_name: supporter.middle_name,
          last_name: supporter.last_name,
          print_name: supporter.print_name,
          contact_number: supporter.contact_number,
          email: supporter.email,
          village_id: supporter.village_id,
          village_name: supporter.village&.name,
          precinct_number: supporter.precinct&.number,
          source: supporter.source,
          intake_status: supporter.intake_status,
          review_status: supporter.review_status,
          public_review_status: supporter.public_review_status,
          self_reported_registered_voter_status: supporter.self_reported_registered_voter_status,
          self_reported_voting_location: supporter.self_reported_voting_location,
          registered_voter: supporter.registered_voter,
          verification_status: supporter.verification_status,
          verification_reason: supporter.verification_reason,
          verification_reason_label: SupporterVerificationReasonService.new(supporter).payload&.dig(:verification_reason_label),
          referred_by_name: supporter.referred_by_name,
          household_group_id: supporter.household_group_id,
          wants_to_volunteer: supporter.wants_to_volunteer,
          needs_absentee_ballot_help: supporter.needs_absentee_ballot_help,
          needs_homebound_voting_help: supporter.needs_homebound_voting_help,
          needs_voter_registration_help: supporter.needs_voter_registration_help,
          needs_election_day_ride: supporter.needs_election_day_ride,
          campaign_help_requests: supporter.campaign_help_requests,
          registration_outreach_status: supporter.registration_outreach_status,
          registration_outreach_notes: supporter.registration_outreach_notes,
          registration_outreach_date: supporter.registration_outreach_date&.iso8601,
          registration_outreach_updated_by_user_name: supporter.registration_outreach_updated_by_user&.name,
          status: supporter.status,
          created_at: supporter.created_at&.iso8601
        }
      end

      def supporter_detail_json(supporter)
        reason_payload = SupporterVerificationReasonService.new(supporter, allow_match_lookup: true).payload || {}

        supporter_json(supporter, reason_payload: reason_payload).merge(
          block_name: supporter.block&.name,
          household_members: supporter.household_group&.supporters&.reject { |member| member.id == supporter.id }&.sort_by(&:created_at)&.map do |member|
            {
              id: member.id,
              first_name: member.first_name,
              middle_name: member.middle_name,
              last_name: member.last_name,
              print_name: member.print_name,
              relationship_label: member.id == supporter.id ? "Primary" : "Household member",
              self_reported_registered_voter_status: member.self_reported_registered_voter_status,
              registered_voter: member.registered_voter,
              campaign_help_requests: member.campaign_help_requests
            }
          end || [],
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
        current_user&.admin? || current_user&.data_team? || current_user&.coordinator?
      end

      def verification_update_attributes(supporter, new_status, match_payload: nil)
        attrs = { verification_status: new_status }
        if new_status == "verified"
          best_match = (match_payload || verification_match_payload(supporter))[:best_match]
          attrs.merge!(
            verified_by_user_id: current_user.id,
            verified_at: Time.current,
            verification_reason: "manual_staff_verified",
            verification_reason_metadata: {
              "gec_village_name" => best_match&.dig(:gec_voter)&.village_name,
              "confidence" => best_match&.dig(:confidence)&.to_s,
              "match_type" => best_match&.dig(:match_type)&.to_s,
              "match_count" => best_match&.dig(:match_count)
            }.compact,
            referred_from_village_id: nil
          )
        elsif new_status == "flagged"
          attrs.merge!(
            verified_by_user_id: nil,
            verified_at: nil,
            verification_reason: "manual_staff_flag",
            verification_reason_metadata: {},
            referred_from_village_id: nil
          )
        else
          attrs.merge!(
            verified_by_user_id: nil,
            verified_at: nil,
            verification_reason: nil,
            verification_reason_metadata: {},
            referred_from_village_id: nil
          )
        end
        attrs
      end

      def verification_match_payload(supporter)
        matches = GecVoter.find_matches(
          first_name: supporter.first_name,
          last_name: supporter.last_name,
          dob: supporter.dob,
          birth_year: supporter.dob&.year,
          village_name: supporter.village&.name
        )

        {
          matches: matches,
          best_match: matches.first
        }
      end

      def current_quota_period_id_for_approval
        CampaignCycle.current_quota_period&.id
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
        when "accepted_to_quota"
          "Sent to supporter review"
        else
          action.to_s.humanize
        end
      end

      def duplicate_merge_audit_fields
        %w[email registered_voter self_reported_registered_voter motorcade_available yard_sign opt_in_email opt_in_text]
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
