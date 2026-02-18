# frozen_string_literal: true

module Api
  module V1
    class LeaderboardController < ApplicationController
      include Authenticatable
      before_action :authenticate_request
      before_action :require_leaderboard_access!

      # GET /api/v1/leaderboard
      def index
        base_scope = scope_supporters(
          Supporter.active
            .where("leader_code IS NOT NULL OR entered_by_user_id IS NOT NULL")
            .includes(:village, :entered_by, referral_code: :assigned_user)
        )

        grouped = {}
        totals = {
          qr_signups: 0,
          manual_entries: 0,
          scan_entries: 0,
          import_entries: 0
        }

        # TODO: Refactor to SQL GROUP BY aggregation for better performance at scale
        base_scope.limit(10_000).find_each do |supporter|
          attribution = attribution_channel_for(supporter)
          next unless attribution

          owner_key, owner_data = owner_identity_for(supporter, attribution)
          next if owner_key.blank?

          grouped[owner_key] ||= {
            leader_code: owner_data[:leader_code],
            owner_name: owner_data[:owner_name],
            assigned_user_name: owner_data[:assigned_user_name],
            assigned_user_email: owner_data[:assigned_user_email],
            village_name: owner_data[:village_name],
            qr_signups: 0,
            manual_entries: 0,
            scan_entries: 0,
            import_entries: 0,
            total_added: 0,
            latest_signup_at: nil
          }

          grouped[owner_key][attribution] += 1
          grouped[owner_key][:total_added] += 1
          totals[attribution] += 1

          current_latest = grouped[owner_key][:latest_signup_at]
          grouped[owner_key][:latest_signup_at] = supporter.created_at if current_latest.nil? || supporter.created_at > current_latest
        end

        sorted = grouped.values.sort_by { |row| [ -row[:qr_signups], -row[:total_added], row[:owner_name].to_s ] }
        leaderboard = sorted.map.with_index do |row, idx|
          {
            rank: idx + 1,
            leader_code: row[:leader_code],
            owner_name: row[:owner_name],
            assigned_user_name: row[:assigned_user_name],
            assigned_user_email: row[:assigned_user_email],
            signup_count: row[:qr_signups],
            qr_signups: row[:qr_signups],
            manual_entries: row[:manual_entries],
            scan_entries: row[:scan_entries],
            import_entries: row[:import_entries],
            total_added: row[:total_added],
            village_name: row[:village_name],
            latest_signup: row[:latest_signup_at]&.iso8601
          }
        end

        total_qr_signups = totals[:qr_signups]
        active_leaders = leaderboard.size
        top_leader_count = leaderboard.first&.dig(:qr_signups).to_i
        total_added = totals.values.sum

        render json: {
          leaderboard: leaderboard,
          stats: {
            total_qr_signups: total_qr_signups,
            total_manual_entries: totals[:manual_entries],
            total_scan_entries: totals[:scan_entries],
            total_import_entries: totals[:import_entries],
            total_added: total_added,
            active_leaders: active_leaders,
            top_leader_signups: top_leader_count,
            avg_signups_per_leader: active_leaders > 0 ? (total_qr_signups.to_f / active_leaders).round(1) : 0
          }
        }
      end

      private

      def attribution_channel_for(supporter)
        case supporter.attribution_method
        when "qr_self_signup"
          :qr_signups
        when "staff_manual"
          :manual_entries
        when "staff_scan"
          :scan_entries
        when "bulk_import"
          :import_entries
        else
          nil
        end
      end

      def owner_identity_for(supporter, attribution)
        if attribution == :qr_signups
          referral = supporter.referral_code
          if referral&.assigned_user
            user = referral.assigned_user
            return [
              "user:#{user.id}",
              {
                leader_code: referral.code,
                owner_name: user.name.presence || user.email,
                assigned_user_name: user.name,
                assigned_user_email: user.email,
                village_name: referral.village&.name || supporter.village&.name || "Unknown"
              }
            ]
          end

          label = referral&.display_name.presence || supporter.leader_code
          code = referral&.code.presence || supporter.leader_code
          return [
            "code:#{code}",
            {
              leader_code: code,
              owner_name: label,
              assigned_user_name: nil,
              assigned_user_email: nil,
              village_name: referral&.village&.name || supporter.village&.name || "Unknown"
            }
          ]
        end

        entry_user = supporter.entered_by
        return [ nil, {} ] unless entry_user

        [
          "user:#{entry_user.id}",
          {
            leader_code: supporter.leader_code.presence || "staff-#{entry_user.id}",
            owner_name: entry_user.name.presence || entry_user.email,
            assigned_user_name: entry_user.name,
            assigned_user_email: entry_user.email,
            village_name: supporter.village&.name || "Unknown"
          }
        ]
      end
    end
  end
end
