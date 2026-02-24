# frozen_string_literal: true

module Api
  module V1
    class SessionController < ApplicationController
      include Authenticatable
      before_action :authenticate_request

      # GET /api/v1/session
      def show
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"

        render json: {
          user: {
            id: current_user.id,
            email: current_user.email,
            name: current_user.name,
            role: current_user.role,
            assigned_village_id: current_user.assigned_village_id,
            assigned_district_id: current_user.assigned_district_id,
            assigned_block_id: current_user.assigned_block_id,
            scoped_village_ids: scoped_village_ids
          },
          counts: {
            pending_vetting: scope_supporters(Supporter.active.unverified).count,
            flagged_supporters: scope_supporters(Supporter.active.flagged).count,
            public_signups_pending: Supporter.active.public_signups.count,
            quota_eligible: scope_supporters(Supporter.active.quota_eligible).count
          },
          permissions: {
            can_manage_users: can_manage_users?,
            can_manage_configuration: can_manage_configuration?,
            can_send_sms: can_send_sms?,
            can_send_email: can_send_email?,
            can_edit_supporters: can_edit_supporters?,
            can_view_supporters: can_view_supporters?,
            can_create_staff_supporters: can_create_staff_supporters?,
            can_access_events: can_access_events?,
            can_access_qr: can_access_qr?,
            can_access_leaderboard: can_access_leaderboard?,
            can_access_war_room: can_access_war_room?,
            can_access_poll_watcher: can_access_poll_watcher?,
            can_access_duplicates: can_access_duplicates?,
            can_access_audit_logs: can_access_audit_logs?,
            can_access_data_team: current_user.admin? || current_user.data_team?,
            can_access_reports: current_user.admin? || current_user.data_team? || current_user.coordinator?,
            can_upload_gec: current_user.admin? || current_user.data_team?,
            can_bulk_vet: current_user.admin? || current_user.data_team?,
            can_review_public: current_user.admin? || current_user.data_team? || current_user.coordinator?,
            default_route: current_user.data_team? ? "/team" : "/admin",
            manageable_roles: manageable_roles_for_current_user
          }
        }
      end
    end
  end
end
