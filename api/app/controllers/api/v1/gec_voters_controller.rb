# frozen_string_literal: true

module Api
  module V1
    class GecVotersController < ApplicationController
      include Authenticatable
      include AuditLoggable
      before_action :authenticate_request
      before_action :require_admin!

      # GET /api/v1/gec_voters
      # List GEC voters with optional filters
      def index
        scope = GecVoter.active

        scope = scope.where("LOWER(village_name) = ?", params[:village].downcase.strip) if params[:village].present?
        scope = scope.where("LOWER(last_name) LIKE ?", "#{params[:last_name].downcase.strip}%") if params[:last_name].present?
        scope = scope.where("LOWER(first_name) LIKE ?", "#{params[:first_name].downcase.strip}%") if params[:first_name].present?

        if params[:list_date].present?
          list_date = Date.parse(params[:list_date]) rescue nil
          return render_api_error(message: "Invalid date format for list_date", status: :unprocessable_entity, code: "invalid_date") unless list_date
          scope = scope.for_list_date(list_date)
        end

        scope = scope.order(:village_name, :last_name, :first_name)

        # Paginate
        page = (params[:page] || 1).to_i
        per_page = [ (params[:per_page] || 50).to_i, 200 ].min
        total = scope.count
        voters = scope.offset((page - 1) * per_page).limit(per_page)

        render json: {
          gec_voters: voters.as_json(only: [ :id, :first_name, :last_name, :dob, :village_name, :village_id, :voter_registration_number, :status, :dob_ambiguous, :gec_list_date ]),
          pagination: { page: page, per_page: per_page, total: total, total_pages: (total.to_f / per_page).ceil }
        }
      end

      # GET /api/v1/gec_voters/stats
      # Overview stats about the current GEC voter list
      def stats
        latest_date = GecVoter.active.maximum(:gec_list_date)
        latest_import = GecImport.completed.latest.first

        village_counts = GecVoter.active
          .group(:village_name)
          .count
          .sort_by { |_name, count| -count }

        render json: {
          total_voters: GecVoter.active.count,
          latest_list_date: latest_date,
          latest_import: latest_import&.as_json(only: [ :id, :gec_list_date, :filename, :total_records, :new_records, :updated_records, :ambiguous_dob_count, :status, :created_at ]),
          villages: village_counts.map { |name, count| { name: name, count: count } },
          ambiguous_dob_count: GecVoter.active.with_ambiguous_dob.count
        }
      end

      # POST /api/v1/gec_voters/upload
      # Upload a new GEC voter list (Excel file)
      def upload
        file = params[:file]
        unless file.respond_to?(:tempfile)
          return render_api_error(
            message: "No file uploaded",
            status: :unprocessable_entity,
            code: "missing_file"
          )
        end

        unless params[:gec_list_date].present?
          return render_api_error(
            message: "gec_list_date is required (YYYY-MM-DD)",
            status: :unprocessable_entity,
            code: "missing_list_date"
          )
        end

        gec_list_date = Date.parse(params[:gec_list_date]) rescue nil
        return render_api_error(message: "Invalid date format for gec_list_date", status: :unprocessable_entity, code: "invalid_date") unless gec_list_date
        sheet_name = params[:sheet_name]

        service = GecImportService.new(
          file_path: file.tempfile.path,
          gec_list_date: gec_list_date,
          uploaded_by_user: current_user,
          sheet_name: sheet_name
        )

        result = service.call

        if result.success
          log_audit(result.gec_import, "gec_import", changed_data: result.stats)

          render json: {
            message: "GEC voter list imported successfully",
            import: result.gec_import.as_json(only: [ :id, :gec_list_date, :filename, :total_records, :new_records, :updated_records, :ambiguous_dob_count, :status ]),
            stats: result.stats,
            errors: result.errors.first(20)
          }, status: :created
        else
          render_api_error(
            message: "Import failed: #{result.errors.first}",
            status: :unprocessable_entity,
            code: "import_failed",
            details: result.errors.first(20)
          )
        end
      end

      # POST /api/v1/gec_voters/preview
      # Preview a GEC voter list file without importing
      def preview
        file = params[:file]
        unless file.respond_to?(:tempfile)
          return render_api_error(
            message: "No file uploaded",
            status: :unprocessable_entity,
            code: "missing_file"
          )
        end

        service = GecImportService.new(
          file_path: file.tempfile.path,
          gec_list_date: Date.today, # doesn't matter for preview
          sheet_name: params[:sheet_name]
        )

        preview_data = service.preview(limit: (params[:limit] || 20).to_i)

        render json: {
          sheets: preview_data[:sheets],
          headers: preview_data[:headers],
          column_map: preview_data[:column_map],
          row_count: preview_data[:row_count],
          preview_rows: preview_data[:preview_rows]
        }
      end

      # GET /api/v1/gec_voters/imports
      # List past GEC imports
      def imports
        imports = GecImport.latest.limit(20)

        render json: {
          imports: imports.as_json(only: [ :id, :gec_list_date, :filename, :total_records, :new_records, :updated_records, :removed_records, :ambiguous_dob_count, :status, :created_at ])
        }
      end

      # POST /api/v1/gec_voters/match
      # Test matching for a specific supporter against GEC list
      def match
        matches = GecVoter.find_matches(
          first_name: params[:first_name],
          last_name: params[:last_name],
          dob: params[:dob].present? ? (Date.parse(params[:dob]) rescue nil) : nil,
          village_name: params[:village_name]
        )

        render json: {
          matches: matches.map do |m|
            {
              gec_voter: m[:gec_voter].as_json(only: [ :id, :first_name, :last_name, :dob, :village_name, :voter_registration_number ]),
              confidence: m[:confidence],
              match_type: m[:match_type]
            }
          end
        }
      end
    end
  end
end
