# frozen_string_literal: true

module Api
  module V1
    class VillagesController < ApplicationController
      include Authenticatable
      before_action :authenticate_request, only: [ :show, :update ]
      before_action :require_supporter_access!, only: [ :show ]
      before_action :require_coordinator_or_above!, only: [ :update ]

      # GET /api/v1/villages (public — for signup form dropdown)
      def index
        villages = Village.includes(:precincts).order(:name)
        render json: {
          villages: villages.map { |v|
            {
              id: v.id,
              name: v.name,
              region: v.region,
              registered_voters: v.registered_voters,
              precincts: v.precincts.order(:number).map { |p|
                { id: p.id, number: p.number, alpha_range: p.alpha_range }
              }
            }
          }
        }
      end

      # GET /api/v1/villages/:id
      def show
        village = Village.includes(:precincts, :blocks).find(params[:id])
        campaign = Campaign.active.first

        quota = village.quotas.where(campaign: campaign).first
        supporter_count = village.supporters.active.count
        precinct_supporter_counts = village.supporters.active.where.not(precinct_id: nil).group(:precinct_id).count
        unassigned_precinct_count = village.supporters.active.where(precinct_id: nil).count

        render json: {
          village: {
            id: village.id,
            name: village.name,
            region: village.region,
            registered_voters: village.registered_voters,
            supporter_count: supporter_count,
            quota_target: quota&.target_count || 0,
            precincts: village.precincts.order(:number).map { |p|
              {
                id: p.id,
                number: p.number,
                alpha_range: p.alpha_range,
                registered_voters: p.registered_voters,
                polling_site: p.polling_site,
                supporter_count: precinct_supporter_counts[p.id] || 0
              }
            },
            unassigned_precinct_count: unassigned_precinct_count,
            blocks: village.blocks.order(:name).map { |b|
              {
                id: b.id,
                name: b.name,
                supporter_count: b.supporters.active.count
              }
            }
          }
        }
      end

      # PATCH /api/v1/villages/:id
      def update
        village = Village.find(params[:id])
        if village_update_params[:registered_voters].to_i <= 0
          return render_api_error(
            message: "Registered voters must be greater than 0",
            status: :unprocessable_entity,
            code: "invalid_registered_voters"
          )
        end

        if village.update(village_update_params)
          changed = village.saved_changes.slice("registered_voters")
          log_village_audit!(village, changed_data: changed) if changed.present?
          render json: {
            village: {
              id: village.id,
              name: village.name,
              region: village.region,
              registered_voters: village.registered_voters,
              updated_at: village.updated_at&.iso8601
            }
          }
        else
          render_api_error(
            message: village.errors.full_messages.join(", "),
            status: :unprocessable_entity,
            code: "village_update_failed"
          )
        end
      end

      private

      def village_params
        params.require(:village).permit(:registered_voters, :change_note)
      end

      def village_update_params
        village_params.to_h.except("change_note")
      end

      def log_village_audit!(village, changed_data:)
        metadata = { resource: "village" }
        change_note = village_params[:change_note].to_s.strip
        metadata[:change_note] = change_note if change_note.present?
        AuditLog.create!(
          auditable: village,
          actor_user: current_user,
          action: "updated",
          changed_data: normalized_changed_data(changed_data),
          metadata: metadata
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
    end
  end
end
