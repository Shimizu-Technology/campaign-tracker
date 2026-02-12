# frozen_string_literal: true

module Api
  module V1
    class LeaderboardController < ApplicationController
      include Authenticatable
      before_action :authenticate_request

      # GET /api/v1/leaderboard
      def index
        # Group supporters by leader_code, count signups
        leaders = Supporter.where.not(leader_code: [nil, ""])
          .group(:leader_code)
          .having("COUNT(*) >= 2")
          .order("count_all DESC")
          .count

        leaderboard = leaders.map.with_index do |(code, count), idx|
          # Get a sample supporter to find village info
          sample = Supporter.where(leader_code: code).includes(:village).first
          {
            rank: idx + 1,
            leader_code: code,
            signup_count: count,
            village_name: sample&.village&.name || "Unknown",
            latest_signup: Supporter.where(leader_code: code).maximum(:created_at)&.iso8601
          }
        end

        # Stats
        total_qr_signups = Supporter.where.not(leader_code: [nil, ""]).count
        active_leaders = leaders.size
        top_leader_count = leaders.values.first || 0

        render json: {
          leaderboard: leaderboard,
          stats: {
            total_qr_signups: total_qr_signups,
            active_leaders: active_leaders,
            top_leader_signups: top_leader_count,
            avg_signups_per_leader: active_leaders > 0 ? (total_qr_signups.to_f / active_leaders).round(1) : 0
          }
        }
      end
    end
  end
end
