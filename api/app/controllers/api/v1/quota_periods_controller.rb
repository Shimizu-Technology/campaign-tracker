# frozen_string_literal: true

module Api
  module V1
    class QuotaPeriodsController < ApplicationController
      include Authenticatable

      before_action :require_authentication!
      before_action :set_quota_period, only: %i[show update submit village_quotas update_village_quotas]

      # GET /api/v1/quota_periods/:id
      def show
        render json: { quota_period: period_detail_json(@quota_period) }
      end

      # PATCH /api/v1/quota_periods/:id
      def update
        require_permission!(:can_manage_configuration)

        if @quota_period.update(quota_period_params)
          render json: { quota_period: period_detail_json(@quota_period) }
        else
          render json: { errors: @quota_period.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/quota_periods/:id/submit
      # Snapshot the current counts and mark as submitted
      def submit
        require_permission!(:can_access_data_team)

        if @quota_period.status == "submitted"
          render json: { error: "Period already submitted" }, status: :unprocessable_entity
          return
        end

        @quota_period.submit!
        render json: {
          quota_period: period_detail_json(@quota_period),
          message: "Period submitted successfully"
        }
      end

      # GET /api/v1/quota_periods/:id/village_quotas
      def village_quotas
        render json: {
          village_quotas: @quota_period.village_quotas.includes(:village).map { |vq|
            {
              id: vq.id,
              village_id: vq.village_id,
              village_name: vq.village&.name,
              target: vq.target,
              submitted_count: vq.submitted_count
            }
          }
        }
      end

      # PATCH /api/v1/quota_periods/:id/village_quotas
      # Bulk update village targets: { village_quotas: [{ village_id: 1, target: 300 }, ...] }
      def update_village_quotas
        require_permission!(:can_manage_configuration)

        updates = params[:village_quotas] || []
        updates.each do |vq_params|
          vq = @quota_period.village_quotas.find_or_initialize_by(village_id: vq_params[:village_id])
          vq.update!(target: vq_params[:target])
        end

        render json: { message: "Village quotas updated", count: updates.size }
      end

      private

      def set_quota_period
        @quota_period = QuotaPeriod.find(params[:id])
      end

      def quota_period_params
        params.permit(:name, :start_date, :end_date, :due_date, :quota_target, :status)
      end

      def period_detail_json(period)
        {
          id: period.id,
          name: period.name,
          campaign_cycle_id: period.campaign_cycle_id,
          campaign_cycle_name: period.campaign_cycle&.name,
          start_date: period.start_date,
          end_date: period.end_date,
          due_date: period.due_date,
          quota_target: period.quota_target,
          status: period.status,
          eligible_count: period.eligible_count,
          total_assigned: period.total_assigned,
          days_until_due: period.days_until_due,
          overdue: period.overdue?,
          due_soon: period.due_soon?,
          submission_summary: period.submission_summary,
          village_breakdown: period.village_breakdown
        }
      end
    end
  end
end
