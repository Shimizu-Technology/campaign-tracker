# frozen_string_literal: true

module Api
  module V1
    class SprintGoalsController < ApplicationController
      include Authenticatable
      include AuditLoggable
      before_action :authenticate_request
      before_action :require_configuration_access!
      before_action :set_sprint_goal, only: [ :update, :destroy ]

      # GET /api/v1/sprint_goals
      def index
        campaign = Campaign.active.first
        unless campaign
          return render_api_error(message: "No active campaign", status: :not_found, code: "no_campaign")
        end

        sprint_goals = campaign.sprint_goals.includes(:village).order(created_at: :desc)
        sprint_goals = sprint_goals.where(status: params[:status]) if params[:status].present?

        render json: sprint_goals.map { |sg| sprint_goal_json(sg) }
      end

      # POST /api/v1/sprint_goals
      def create
        campaign = Campaign.active.first
        unless campaign
          return render_api_error(message: "No active campaign", status: :not_found, code: "no_campaign")
        end

        sprint_goal = campaign.sprint_goals.build(sprint_goal_params)

        if sprint_goal.save
          log_audit!(sprint_goal, action: "sprint_goal_created", changed_data: sprint_goal.attributes.except("id", "created_at", "updated_at"))
          render json: sprint_goal_json(sprint_goal), status: :created
        else
          render_api_error(message: sprint_goal.errors.full_messages.join(", "), status: :unprocessable_entity, code: "validation_error")
        end
      end

      # PATCH /api/v1/sprint_goals/:id
      def update
        if @sprint_goal.update(sprint_goal_params)
          log_audit!(@sprint_goal, action: "sprint_goal_updated", changed_data: @sprint_goal.saved_changes.except("updated_at"), normalize: true)
          render json: sprint_goal_json(@sprint_goal)
        else
          render_api_error(message: @sprint_goal.errors.full_messages.join(", "), status: :unprocessable_entity, code: "validation_error")
        end
      end

      # DELETE /api/v1/sprint_goals/:id
      def destroy
        @sprint_goal.destroy!
        log_audit!(@sprint_goal, action: "sprint_goal_deleted", changed_data: { title: @sprint_goal.title })
        head :no_content
      end

      private

      def set_sprint_goal
        @sprint_goal = SprintGoal.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render_api_error(message: "Sprint goal not found", status: :not_found, code: "not_found")
      end

      def require_configuration_access!
        unless can_manage_configuration?
          render_api_error(message: "Configuration access required", status: :forbidden, code: "forbidden")
        end
      end

      def sprint_goal_params
        params.require(:sprint_goal).permit(:title, :target_count, :current_count, :start_date, :end_date, :period_type, :status, :village_id)
      end

      def sprint_goal_json(sg)
        {
          id: sg.id,
          campaign_id: sg.campaign_id,
          village_id: sg.village_id,
          village_name: sg.village&.name,
          title: sg.title,
          target_count: sg.target_count,
          current_count: sg.current_count,
          start_date: sg.start_date,
          end_date: sg.end_date,
          period_type: sg.period_type,
          status: sg.status,
          progress_percentage: sg.progress_percentage,
          created_at: sg.created_at,
          updated_at: sg.updated_at
        }
      end

      def audit_entry_mode
        "sprint_goals"
      end
    end
  end
end
