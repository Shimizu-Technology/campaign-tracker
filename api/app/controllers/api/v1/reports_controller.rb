# frozen_string_literal: true

module Api
  module V1
    class ReportsController < ApplicationController
      include Authenticatable
      include AuditLoggable
      before_action :authenticate_request
      before_action :require_data_ops_access!

      # GET /api/v1/reports/:report_type
      # Generate and download an Excel report.
      # Params:
      #   report_type: support_list | purge_list | transfer_list | referral_list | quota_summary
      #   village_id (optional): filter to a specific village
      def show
        report_type = params[:report_type]

        unless ReportGenerator::REPORT_TYPES.include?(report_type)
          return render_api_error(
            message: "Unknown report type: #{report_type}. Valid types: #{ReportGenerator::REPORT_TYPES.join(', ')}",
            status: :unprocessable_entity,
            code: "invalid_report_type"
          )
        end

        generator = ReportGenerator.new(
          report_type: report_type,
          village_id: params[:village_id],
          precinct_id: params[:precinct_id],
          district_id: params[:district_id],
          campaign_id: params[:campaign_id]
        )

        begin
          result = generator.generate
        rescue => e
          Rails.logger.error("Report generation failed: #{e.message}\n#{e.backtrace&.first(10)&.join("\n")}")
          return render_api_error(
            message: "Report generation failed: #{e.message}",
            status: :internal_server_error,
            code: "report_generation_failed"
          )
        end

        log_audit!(nil, action: "report_generated", changed_data: {
          "report_type" => report_type,
          "village_id" => params[:village_id],
          "filename" => result[:filename]
        })

        send_data result[:package].to_stream.read,
          filename: result[:filename],
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          disposition: "attachment"
      end

      # GET /api/v1/reports/:report_type/preview
      def preview
        report_type = params[:report_type]

        unless ReportGenerator::REPORT_TYPES.include?(report_type)
          return render_api_error(
            message: "Unknown report type: #{report_type}. Valid types: #{ReportGenerator::REPORT_TYPES.join(', ')}",
            status: :unprocessable_entity,
            code: "invalid_report_type"
          )
        end

        generator = ReportGenerator.new(
          report_type: report_type,
          village_id: params[:village_id],
          precinct_id: params[:precinct_id],
          district_id: params[:district_id],
          campaign_id: params[:campaign_id],
          preview_limit: (params[:limit] || 100).to_i.clamp(1, 250)
        )

        begin
          result = generator.preview
        rescue => e
          Rails.logger.error("Report preview failed: #{e.message}\n#{e.backtrace&.first(10)&.join("\n")}")
          return render_api_error(
            message: "Report preview failed: #{e.message}",
            status: :internal_server_error,
            code: "report_preview_failed"
          )
        end

        render json: result.merge(
          report_type: report_type,
          filters: {
            village_id: params[:village_id],
            precinct_id: params[:precinct_id],
            district_id: params[:district_id]
          }
        )
      end

      # GET /api/v1/reports
      # List available report types with current counts
      def index
        latest_gec = GecVoter.maximum(:gec_list_date)
        latest_import = GecImport.completed.latest.first
        current_period = CampaignCycle.current_quota_period
        village_changes = GecVoter.transferred
          .where.not(village_name: GecImportService::UNASSIGNED_VILLAGE_NAME)
          .where.not(previous_village_name: GecImportService::UNASSIGNED_VILLAGE_NAME)
        mapping_issues = GecVoter.transferred.where(village_name: GecImportService::UNASSIGNED_VILLAGE_NAME)
          .or(GecVoter.transferred.where(previous_village_name: GecImportService::UNASSIGNED_VILLAGE_NAME))

        render json: {
          available_reports: ReportGenerator::REPORT_TYPES.map do |rt|
            {
              type: rt,
              name: report_name(rt),
              description: report_description(rt)
            }
          end,
          latest_gec_list_date: latest_gec,
          gec_data_loaded: GecVoter.active.any?,
          quick_stats: {
            official_supporters: Supporter.working_supporters.count,
            matched_to_gec: Supporter.working_supporters.verified.count,
            current_quota_progress: current_period&.total_assigned.to_i,
            current_quota_target: current_period&.effective_quota_target.to_i,
            quota_eligible: Supporter.working_supporters.count,
            total_verified: Supporter.working_supporters.verified.count,
            total_active: Supporter.working_supporters.count,
            public_signups: Supporter.active.public_signups.count,
            unregistered: Supporter.working_supporters.where(registered_voter: false).count,
            transfer_list_size: village_changes.count,
            referral_list_size: Supporter.working_supporters.where.not(referred_from_village_id: nil).count,
            mapping_issues_list_size: mapping_issues.count,
            transfers: village_changes.count,
            purge_list_size: GecVoter.where(status: "removed").count,
            latest_import_removed_voters: latest_import&.removed_records.to_i
          }
        }
      end

      private

      def report_name(type)
        case type
        when "transfer_list"
          "Village Change List"
        when "mapping_issues_list"
          "Village Mapping Issues"
        else
          type.humanize.titleize
        end
      end

      def report_description(type)
        case type
        when "support_list"
          "All approved official supporters by village"
        when "purge_list"
          "Voters removed from GEC list (deceased or purged)"
        when "transfer_list"
          "GEC voters whose official village changed between list versions"
        when "referral_list"
          "Official supporters submitted under one village but matched to another"
        when "mapping_issues_list"
          "GEC voters whose latest village could not be mapped cleanly to an official village"
        when "quota_summary"
          "Per-village quota progress for the current period with official totals and status"
        end
      end
    end
  end
end
