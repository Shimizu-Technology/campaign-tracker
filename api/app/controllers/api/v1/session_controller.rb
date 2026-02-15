# frozen_string_literal: true

module Api
  module V1
    class SessionController < ApplicationController
      include Authenticatable
      before_action :authenticate_request

      # GET /api/v1/session
      def show
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
            pending_vetting: scope_supporters(Supporter.unverified).count
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
            manageable_roles: manageable_roles_for_current_user
          }
        }
      end
    end
  end
end
