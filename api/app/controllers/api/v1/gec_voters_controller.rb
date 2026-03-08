# frozen_string_literal: true

require "digest"

module Api
  module V1
    class GecVotersController < ApplicationController
      include Authenticatable
      include AuditLoggable
      before_action :authenticate_request
      before_action :require_coordinator_or_above!

      # GET /api/v1/gec_voters
      # List GEC voters with optional filters
      def index
        scope = GecVoter.active

        scope = scope.where("LOWER(village_name) = ?", params[:village].downcase.strip) if params[:village].present?
        scope = scope.where("LOWER(last_name) LIKE ?", "#{ActiveRecord::Base.sanitize_sql_like(params[:last_name].downcase.strip)}%") if params[:last_name].present?
        scope = scope.where("LOWER(first_name) LIKE ?", "#{ActiveRecord::Base.sanitize_sql_like(params[:first_name].downcase.strip)}%") if params[:first_name].present?

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
          removed_voters: GecVoter.removed.count,
          transferred_voters: GecVoter.transferred.count,
          latest_list_date: latest_date,
          latest_import: latest_import&.as_json(only: [ :id, :gec_list_date, :filename, :total_records, :new_records, :updated_records, :removed_records, :transferred_records, :re_vetted_count, :ambiguous_dob_count, :import_type, :status, :created_at ]),
          villages: village_counts.map { |name, count| { name: name, count: count } },
          ambiguous_dob_count: GecVoter.active.with_ambiguous_dob.count,
          last_change_summary: latest_import&.change_summary
        }
      end

      # POST /api/v1/gec_voters/upload
      # Upload a new GEC voter list (Excel/CSV, or PDF with parser + QA gate)
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

        import_type = %w[full_list changes_only].include?(params[:import_type]) ? params[:import_type] : "full_list"

        import_file_path = file.tempfile.path
        pdf_qa = nil
        pdf_warnings = []
        csv_tempfile = nil
        async_import = params[:async_import].nil? ? true : ActiveModel::Type::Boolean.new.cast(params[:async_import])

        begin
          confirm_review = ActiveModel::Type::Boolean.new.cast(params[:confirm_review])

          if pdf_file?(file) && !async_import
            parser = GecPdfParserService.new(file_path: file.tempfile.path)
            # Always do a full parse on upload (we need the rows to write the CSV).
            # The cache is only used for QA gate validation — if it matches, we skip
            # re-validating QA and trust the already-approved preview result.
            expected_cache_key = build_pdf_parse_cache_key(file.tempfile.path)
            requested_cache_key = params[:parse_cache_key].presence
            cache_key = requested_cache_key == expected_cache_key ? requested_cache_key : nil
            cached_qa = read_cached_pdf_parse(cache_key)
            parsed = parser.parse

            if parsed.errors.any?
              return render_api_error(
                message: "PDF parsing failed: #{parsed.errors.first}",
                status: :unprocessable_entity,
                code: "pdf_parse_failed",
                details: parsed.errors.first(10)
              )
            end

            # Prefer preview-approved QA when cache key matches, but sanity-check fresh parse.
            fresh_qa = parsed.qa || {}
            cached_pdf_qa = cached_qa&.qa.presence
            pdf_qa = cached_pdf_qa || fresh_qa
            pdf_warnings = parsed.warnings

            if cached_pdf_qa.present?
              cached_rows = cached_pdf_qa[:row_count].to_i
              fresh_rows = fresh_qa[:row_count].to_i

              if cached_rows.positive? && fresh_rows < (cached_rows * 0.95).to_i
                return render_api_error(
                  message: "PDF row count changed significantly since preview (#{fresh_rows} vs #{cached_rows}). Re-preview before importing.",
                  status: :unprocessable_entity,
                  code: "pdf_row_count_mismatch"
                )
              end
            end

            if pdf_qa[:status] == "fail" || fresh_qa[:status] == "fail"
              return render_api_error(
                message: "PDF QA failed. Please review parsing quality before importing.",
                status: :unprocessable_entity,
                code: "pdf_quality_failed",
                details: parsed.warnings
              )
            end

            review_status = (pdf_qa[:status] == "review") || (fresh_qa[:status] == "review")

            if review_status && !confirm_review
              return render_api_error(
                message: "PDF QA is in review status. Confirm review before importing.",
                status: :unprocessable_entity,
                code: "pdf_quality_review_required",
                details: parsed.warnings
              )
            end

            csv_tempfile = parser.write_normalized_csv(parsed.rows)
            import_file_path = csv_tempfile.path
          end

          if async_import
            max_bytes = 50.megabytes
            file_size = File.size(import_file_path)
            if file_size > max_bytes
              return render_api_error(
                message: "Uploaded file is too large (max 50 MB)",
                status: :unprocessable_entity,
                code: "file_too_large"
              )
            end

            # For PDF uploads, the data stored/processed is the converted CSV, so reflect
            # that in the GecImport filename (consistent with GecImportUpload.filename).
            import_display_filename = if pdf_file?(file)
              "#{File.basename(file.original_filename.to_s, ".*")}.csv"
            else
              File.basename(file.original_filename || import_file_path)
            end

            gec_import = GecImport.create!(
              gec_list_date: gec_list_date,
              filename: import_display_filename,
              uploaded_by_user: current_user,
              import_type: import_type,
              status: "pending",
              metadata: {
                "stage" => "queued",
                "progress_percent" => 0,
                "pdf_qa" => pdf_qa,
                "pdf_warnings" => pdf_warnings,
                "mode" => "async"
              }
            )

            begin
              preserve_raw_upload!(gec_import: gec_import, file: file)

              stored_filename = File.basename(file.original_filename || import_file_path)
              stored_content_type = file.content_type

              upload_payload = GecImportUpload.create!(
                gec_import: gec_import,
                filename: stored_filename,
                content_type: stored_content_type,
                file_data: File.binread(import_file_path)
              )

              GecImportJob.perform_later(
                gec_import_id: gec_import.id,
                upload_id: upload_payload.id,
                gec_list_date: gec_list_date.to_s,
                uploaded_by_user_id: current_user&.id,
                sheet_name: sheet_name,
                import_type: import_type,
                confirm_review: confirm_review
              )
            rescue StandardError => e
              upload_payload&.destroy
              S3Service.delete(gec_import.raw_file_s3_key) if gec_import.raw_file_s3_key.present?
              gec_import.update_columns(raw_file_s3_key: nil, raw_filename: nil, raw_content_type: nil)
              gec_import.update!(
                status: "failed",
                metadata: (gec_import.metadata || {}).merge({ "stage" => "failed", "progress_percent" => 100, "error" => "Failed to queue import: #{e.message}" })
              )

              return render_api_error(
                message: "Failed to queue import: #{e.message}",
                status: :unprocessable_entity,
                code: "import_enqueue_failed"
              )
            end

            render json: {
              message: "GEC import queued in background",
              async: true,
              import: gec_import.as_json(only: [ :id, :gec_list_date, :filename, :total_records, :new_records, :updated_records, :removed_records, :transferred_records, :re_vetted_count, :ambiguous_dob_count, :import_type, :status, :metadata ])
            }, status: :accepted
          else
            service = GecImportService.new(
              file_path: import_file_path,
              gec_list_date: gec_list_date,
              uploaded_by_user: current_user,
              sheet_name: sheet_name,
              import_type: import_type
            )

            result = service.call

            if result.success
              if pdf_qa.present? || pdf_warnings.any?
                result.gec_import.update!(
                  metadata: (result.gec_import.metadata || {}).merge({
                    "pdf_qa" => pdf_qa,
                    "pdf_warnings" => pdf_warnings
                  }.compact)
                )
              end
              preserve_raw_upload!(gec_import: result.gec_import, file: file)
              preserve_import_artifact!(
                gec_import: result.gec_import,
                file_path: import_file_path,
                filename: artifact_filename_for_upload(file, import_file_path),
                content_type: artifact_content_type_for_upload(file)
              )
              log_audit!(result.gec_import, action: "gec_import", changed_data: result.stats)

              render json: {
                message: "GEC voter list imported successfully",
                import: result.gec_import.as_json(only: [ :id, :gec_list_date, :filename, :total_records, :new_records, :updated_records, :removed_records, :transferred_records, :re_vetted_count, :ambiguous_dob_count, :import_type, :status, :metadata ]),
                stats: result.stats,
                change_summary: result.gec_import.change_summary,
                pdf_qa: pdf_qa,
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
        ensure
          csv_tempfile&.close!
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

        if pdf_file?(file)
          parser = GecPdfParserService.new(file_path: file.tempfile.path)
          parsed = parser.parse_preview_sample

          if parsed.errors.any?
            return render_api_error(
              message: "Failed to parse PDF: #{parsed.errors.first}",
              status: :unprocessable_entity,
              code: "pdf_parse_error"
            )
          end

          preview_limit = [ (params[:limit] || 20).to_i, 100 ].min
          return render json: {
            source_type: "pdf",
            qa: parsed.qa,
            warnings: parsed.warnings,
            row_count: parsed.rows.size,
            parse_cache_key: nil,
            preview_rows: parsed.rows.first(preview_limit)
          }
        end

        service = GecImportService.new(
          file_path: file.tempfile.path,
          gec_list_date: Date.today, # doesn't matter for preview
          sheet_name: params[:sheet_name]
        )

        begin
          preview_data = service.preview(limit: (params[:limit] || 20).to_i)
        rescue => e
          return render_api_error(
            message: "Failed to parse file: #{e.message}",
            status: :unprocessable_entity,
            code: "parse_error"
          )
        end

        render json: {
          source_type: "spreadsheet",
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
        imports = GecImport.includes(:uploaded_by_user).latest.limit(20)
        rows = imports.map do |imp|
          json = import_json(imp)
          if %w[pending processing].include?(imp.status)
            cached = begin
              Rails.cache.read("gec_import_progress:#{imp.id}")
            rescue StandardError
              nil
            end
            json["metadata"] = (json["metadata"] || {}).merge(cached || {})
          end
          json
        end

        render json: { imports: rows }
      end

      # GET /api/v1/gec_voters/imports/:id/view_data
      # Preview the parsed import artifact for an existing import.
      def view_import_data
        gec_import = GecImport.includes(:uploaded_by_user).find_by(id: params[:id])
        unless gec_import
          return render_api_error(message: "Import not found", status: :not_found, code: "not_found")
        end

        unless gec_import.import_artifact_available?
          return render_api_error(message: "Parsed import data is not available for this import", status: :not_found, code: "parsed_data_not_available")
        end

        preview = build_existing_import_preview(
          gec_import,
          page: (params[:page] || 1).to_i,
          per_page: (params[:per_page] || 100).to_i,
          q: params[:q].to_s,
          village: params[:village].to_s
        )
        unless preview
          return render_api_error(message: "Could not load parsed import data", status: :service_unavailable, code: "artifact_unavailable")
        end

        render json: {
          import: import_json(gec_import),
          preview: preview
        }
      end

      # GET /api/v1/gec_voters/imports/:id/changes
      # View persisted change rows for an existing import.
      def view_import_changes
        gec_import = GecImport.includes(:uploaded_by_user).find_by(id: params[:id])
        unless gec_import
          return render_api_error(message: "Import not found", status: :not_found, code: "not_found")
        end

        per_page = [ (params[:per_page] || 100).to_i, 200 ].min
        page = [ (params[:page] || 1).to_i, 1 ].max
        type = params[:type].to_s.presence || "all"
        q = params[:q].to_s.strip

        scope = gec_import.change_records.latest_first
        scope = apply_change_type_filter(scope, type)
        scope = apply_change_search_filter(scope, q) if q.present?

        total_rows = scope.count
        total_pages = total_rows.zero? ? 1 : (total_rows.to_f / per_page).ceil
        rows = scope.offset((page - 1) * per_page).limit(per_page)

        raw_counts = gec_import.change_records.group(:change_type).count

        render json: {
          import: import_json(gec_import),
          changes: rows.map { |row| import_change_json(row) },
          counts: {
            all: raw_counts.values.sum,
            new: raw_counts["new"].to_i,
            changed: raw_counts["updated"].to_i + raw_counts["transferred"].to_i,
            updated: raw_counts["updated"].to_i,
            removed: raw_counts["removed"].to_i,
            transferred: raw_counts["transferred"].to_i
          },
          filters: {
            type: type,
            q: q
          },
          pagination: {
            page: page,
            per_page: per_page,
            total_pages: total_pages,
            total_rows: total_rows
          }
        }
      end

      # GET /api/v1/gec_voters/imports/:id/view_original
      # Open the true raw uploaded file when available.
      def view_original
        gec_import = GecImport.find_by(id: params[:id])
        unless gec_import
          return render_api_error(message: "Import not found", status: :not_found, code: "not_found")
        end

        unless gec_import.raw_source_available?
          return render_api_error(message: "Original uploaded file is not available for this import", status: :not_found, code: "file_not_available")
        end

        content_type = gec_import.raw_content_type.presence || "application/octet-stream"
        filename = gec_import.raw_source_filename || gec_import.filename || "gec_import_#{gec_import.id}"
        view_url = S3Service.presigned_url(
          gec_import.raw_file_s3_key,
          expires_in: 300,
          filename: filename,
          disposition: :inline
        )
        unless view_url
          return render_api_error(message: "Could not generate original file link", status: :service_unavailable, code: "s3_error")
        end

        render json: {
          view_url: view_url,
          filename: filename,
          content_type: content_type,
          inline_supported: content_type.include?("pdf")
        }
      end

      # GET /api/v1/gec_voters/imports/:id/download
      # Download the best available file for this import, preferring the raw source file.
      def download_import
        gec_import = GecImport.find_by(id: params[:id])
        unless gec_import
          return render_api_error(message: "Import not found", status: :not_found, code: "not_found")
        end

        unless gec_import.downloadable_file_available?
          return render_api_error(message: "Download file is not available for this import", status: :not_found, code: "file_not_available")
        end

        download_url = S3Service.presigned_url(
          gec_import.downloadable_file_key,
          expires_in: 300,
          filename: gec_import.downloadable_filename,
          disposition: :attachment
        )
        unless download_url
          return render_api_error(message: "Could not generate download link", status: :service_unavailable, code: "s3_error")
        end

        render json: {
          download_url: download_url,
          filename: gec_import.downloadable_filename || "gec_import_#{gec_import.id}"
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

      # POST /api/v1/gec_voters/bulk_vet
      # Re-vet all existing supporters against the current GEC list.
      # Useful after importing a new GEC list.
      def bulk_vet
        scope = Supporter.active

        # Optional: only vet unverified supporters
        scope = scope.unverified if params[:unverified_only] == "true"

        # Optional: filter by village
        if params[:village_id].present?
          scope = scope.where(village_id: params[:village_id])
        end

        total = scope.count
        results = { auto_verified: 0, flagged: 0, referral: 0, unregistered: 0, skipped: 0, errors: 0 }
        gec_data_loaded = GecVoter.active.exists?

        if gec_data_loaded
          scope.find_each do |supporter|
            result = GecVettingService.new(supporter, gec_data_loaded: true).call
            results[result.status] += 1
          rescue StandardError => e
            results[:errors] += 1
            Rails.logger.warn("Bulk vet error for supporter #{supporter.id}: #{e.message}")
          end
        else
          results[:skipped] = total
        end

        log_audit!(nil, action: "bulk_gec_vet", changed_data: results.merge(total: total))

        render json: {
          message: "Bulk vetting complete",
          total: total,
          results: results
        }
      end

      private

      def pdf_file?(file)
        filename = file.respond_to?(:original_filename) ? file.original_filename.to_s : ""
        content_type = file.respond_to?(:content_type) ? file.content_type.to_s : ""

        filename.downcase.end_with?(".pdf") || content_type.include?("pdf")
      end

      def build_pdf_parse_cache_key(file_path)
        digest = Digest::SHA256.file(file_path).hexdigest
        "gec_pdf_parse:v1:#{digest}"
      rescue StandardError => e
        Rails.logger.warn("PDF parse cache key generation failed: #{e.class}: #{e.message}")
        nil
      end

      # Cache only the lightweight QA summary (not the full rows array which can be 30-60 MB
      # for a full ~60k-voter GEC list). On a cache hit we skip re-parsing for QA purposes
      # but still need to write_normalized_csv from a fresh parse — so the cache avoids the
      # QA overhead only; the caller still parses rows when needed.
      def write_cached_pdf_parse(cache_key, parsed)
        return if cache_key.blank?

        Rails.cache.write(
          cache_key,
          { qa: parsed.qa, warnings: parsed.warnings, errors: parsed.errors },
          expires_in: 20.minutes
        )
      end

      # Returns a lightweight cached result (qa/warnings/errors only, rows=[]).
      # Callers must re-parse if they need full row data.
      def read_cached_pdf_parse(cache_key)
        return nil if cache_key.blank?

        cached = begin
          Rails.cache.read(cache_key)
        rescue StandardError
          nil
        end
        return nil unless cached.is_a?(Hash) && cached.key?(:qa)

        GecPdfParserService::Result.new(
          rows: [],
          qa: cached[:qa] || {},
          warnings: cached[:warnings] || [],
          errors: cached[:errors] || []
        )
      end

      def import_json(imp)
        json = imp.as_json(only: [ :id, :gec_list_date, :filename, :total_records, :new_records, :updated_records, :removed_records, :transferred_records, :re_vetted_count, :ambiguous_dob_count, :import_type, :status, :created_at, :metadata ])
        json["uploaded_by_email"] = imp.uploaded_by_user&.email
        json["has_import_artifact"] = imp.import_artifact_available?
        json["has_original_file"] = imp.raw_source_available?
        json["has_downloadable_file"] = imp.downloadable_file_available?
        json["raw_filename"] = imp.raw_filename
        json["original_filename"] = imp.original_filename
        json["raw_content_type"] = imp.raw_content_type
        json["original_content_type"] = imp.original_content_type
        json
      end

      def import_change_json(change)
        {
          id: change.id,
          change_type: change.change_type,
          row_number: change.row_number,
          first_name: change.first_name,
          last_name: change.last_name,
          voter_registration_number: change.voter_registration_number,
          village_name: change.village_name,
          previous_village_name: change.previous_village_name,
          birth_year: change.birth_year,
          dob: change.dob,
          details: change.details || {}
        }
      end

      def apply_change_type_filter(scope, type)
        case type
        when "new", "updated", "removed", "transferred"
          scope.where(change_type: type)
        when "changed"
          scope.where(change_type: %w[updated transferred])
        else
          scope
        end
      end

      def apply_change_search_filter(scope, query)
        like = "%#{ActiveRecord::Base.sanitize_sql_like(query.downcase)}%"
        scope.where(
          "LOWER(COALESCE(first_name, '')) LIKE :q OR LOWER(COALESCE(last_name, '')) LIKE :q OR LOWER(COALESCE(village_name, '')) LIKE :q OR LOWER(COALESCE(previous_village_name, '')) LIKE :q OR LOWER(COALESCE(voter_registration_number, '')) LIKE :q",
          q: like
        )
      end

      def preserve_raw_upload!(gec_import:, file:)
        return unless S3Service.enabled?

        raw_filename = File.basename(file.original_filename.to_s.presence || gec_import.filename.to_s)
        raw_content_type = file.respond_to?(:content_type) ? file.content_type.to_s.presence : nil
        raw_content_type ||= "application/octet-stream"
        safe_filename = S3Service.safe_filename(raw_filename, fallback: "raw_upload")
        s3_key = "gec-imports/#{gec_import.id}/raw/#{safe_filename}"
        upload_result = S3Service.upload(s3_key, File.binread(file.tempfile.path), content_type: raw_content_type)
        unless upload_result
          Rails.logger.error("GecVotersController import #{gec_import.id}: raw upload preservation failed; import will continue without raw source file")
          return
        end

        gec_import.update_columns(
          raw_file_s3_key: s3_key,
          raw_filename: raw_filename,
          raw_content_type: raw_content_type
        )
      rescue StandardError => e
        Rails.logger.error("GecVotersController import #{gec_import.id}: raw preservation error: #{e.class}: #{e.message}; import will continue without raw source file")
      end

      def preserve_import_artifact!(gec_import:, file_path:, filename:, content_type:)
        return unless S3Service.enabled?

        safe_filename = S3Service.safe_filename(filename, fallback: "import_artifact")
        s3_key = "gec-imports/#{gec_import.id}/artifact/#{safe_filename}"
        upload_result = S3Service.upload(s3_key, File.binread(file_path), content_type: content_type)
        unless upload_result
          Rails.logger.warn("GecVotersController import #{gec_import.id}: import artifact preservation failed")
          return
        end

        gec_import.update_columns(
          original_file_s3_key: s3_key,
          original_filename: filename,
          original_content_type: content_type
        )
      rescue StandardError => e
        Rails.logger.warn("GecVotersController import #{gec_import.id}: artifact preservation error: #{e.class}: #{e.message}")
      end

      def artifact_filename_for_upload(file, import_file_path)
        if pdf_file?(file)
          "#{File.basename(file.original_filename.to_s, ".*")}.csv"
        else
          File.basename(file.original_filename.presence || import_file_path)
        end
      end

      def artifact_content_type_for_upload(file)
        pdf_file?(file) ? "text/csv" : (file.content_type.presence || "application/octet-stream")
      end

      def build_existing_import_preview(gec_import, page:, per_page:, q:, village:)
        dataset = fetch_cached_import_viewer_dataset(gec_import)
        return nil unless dataset

        filtered_rows = apply_import_view_filters(
          rows: dataset["rows"] || [],
          source_type: dataset["source_type"],
          q: q,
          village: village
        )

        normalized_per_page = [ [ per_page.to_i, 1 ].max, 250 ].min
        total_rows = filtered_rows.length
        total_pages = total_rows.zero? ? 1 : (total_rows.to_f / normalized_per_page).ceil
        effective_page = [ [ page.to_i, 1 ].max, total_pages ].min
        offset = (effective_page - 1) * normalized_per_page
        page_rows = filtered_rows.slice(offset, normalized_per_page) || []

        {
          source_type: dataset["source_type"],
          sheets: dataset["sheets"],
          headers: dataset["headers"],
          column_map: dataset["column_map"],
          row_count: dataset["row_count"],
          qa: dataset["qa"],
          warnings: dataset["warnings"] || [],
          available_villages: dataset["available_villages"] || [],
          pagination: {
            page: effective_page,
            per_page: normalized_per_page,
            total_pages: total_pages,
            total_rows: total_rows
          },
          preview_rows: page_rows
        }
      rescue StandardError => e
        Rails.logger.warn("GecVotersController import #{gec_import.id}: preview build failed: #{e.class}: #{e.message}")
        nil
      end

      def fetch_cached_import_viewer_dataset(gec_import)
        cache_key = import_viewer_cache_key(gec_import)
        cached = begin
          Rails.cache.read(cache_key)
        rescue StandardError
          nil
        end
        return cached if cached.is_a?(Hash) && cached["rows"].is_a?(Array)

        dataset = build_import_viewer_dataset(gec_import)
        return nil unless dataset

        if dataset_cacheable?(dataset)
          Rails.cache.write(cache_key, dataset, expires_in: 6.hours)
        else
          Rails.logger.info(
            "GecVotersController import #{gec_import.id}: skipped viewer dataset cache " \
            "(rows=#{dataset["row_count"]}, cache_row_limit=#{import_viewer_cache_row_limit})"
          )
        end
        dataset
      rescue StandardError => e
        Rails.logger.warn("GecVotersController import #{gec_import.id}: viewer cache failed: #{e.class}: #{e.message}")
        nil
      end

      def import_viewer_cache_key(gec_import)
        artifact_version = gec_import.original_file_s3_key.to_s
        "gec_import_viewer:v3:#{gec_import.id}:#{Digest::SHA256.hexdigest(artifact_version)}"
      end

      def import_viewer_cache_row_limit
        100_000
      end

      def dataset_cacheable?(dataset)
        dataset["row_count"].to_i <= import_viewer_cache_row_limit
      end

      def build_import_viewer_dataset(gec_import)
        started_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)
        artifact_data = S3Service.download(gec_import.original_file_s3_key)
        return nil unless artifact_data

        filename = gec_import.original_filename.presence || gec_import.filename
        extension = File.extname(filename).downcase
        extension = ".csv" unless %w[.csv .xlsx .xls].include?(extension)

        temp = Tempfile.new([ "gec_import_preview", extension ])
        temp.binmode
        temp.write(artifact_data)
        temp.flush

        service = GecImportService.new(file_path: temp.path, gec_list_date: gec_import.gec_list_date)
        preview_data = service.preview_all

        dataset = if gec_import.imported_from_pdf?
          rows = preview_data[:preview_rows].map do |row|
            {
              "name" => [ row[:last_name], row[:first_name] ].compact.reject(&:blank?).join(", "),
              "village" => row[:village_name],
              "birth_year" => row[:birth_year],
              "voter_registration_number" => row[:voter_registration_number]
            }
          end
          {
            "source_type" => "pdf",
            "qa" => gec_import.metadata["pdf_qa"] || {},
            "warnings" => Array(gec_import.metadata["pdf_warnings"]).first(20),
            "row_count" => preview_data[:row_count],
            "rows" => rows,
            "available_villages" => rows.map { |row| row["village"] }.compact.uniq.sort
          }
        else
          rows = preview_data[:preview_rows].map { |row| row.stringify_keys }
          {
            "source_type" => "spreadsheet",
            "sheets" => preview_data[:sheets],
            "headers" => preview_data[:headers],
            "column_map" => preview_data[:column_map],
            "row_count" => preview_data[:row_count],
            "rows" => rows,
            "available_villages" => rows.map { |row| row["village_name"] || row["village"] }.compact.uniq.sort
          }
        end
        elapsed_ms = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started_at) * 1000).round
        if preview_data[:row_count].to_i >= 25_000 || elapsed_ms >= 1500
          Rails.logger.info(
            "GecVotersController import #{gec_import.id}: built viewer dataset " \
            "(rows=#{preview_data[:row_count]}, elapsed_ms=#{elapsed_ms})"
          )
        end
        dataset
      ensure
        temp&.close!
      end

      def apply_import_view_filters(rows:, source_type:, q:, village:)
        filtered = rows

        if village.present?
          village_field = source_type == "pdf" ? "village" : "village_name"
          filtered = filtered.select do |row|
            row[village_field].to_s.casecmp?(village.strip)
          end
        end

        if q.present?
          query = q.downcase.strip
          searchable_fields = if source_type == "pdf"
            %w[name village birth_year voter_registration_number]
          else
            %w[first_name last_name village_name village birth_year dob voter_registration_number]
          end
          filtered = filtered.select do |row|
            searchable_fields.any? { |field| row[field].to_s.downcase.include?(query) }
          end
        end

        filtered
      end
    end
  end
end
