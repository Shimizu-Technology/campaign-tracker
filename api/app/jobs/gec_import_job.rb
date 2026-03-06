# frozen_string_literal: true

class GecImportJob < ApplicationJob
  queue_as :default

  # Use 2-key advisory lock form for portability and to avoid bigint/casting edge cases.
  FULL_LIST_IMPORT_LOCK_KEY_1 = 81
  FULL_LIST_IMPORT_LOCK_KEY_2 = 1

  def perform(gec_import_id:, upload_id:, gec_list_date:, uploaded_by_user_id: nil, sheet_name: nil, import_type: "full_list")
    gec_import = GecImport.find_by(id: gec_import_id)
    upload = GecImportUpload.find_by(id: upload_id)

    if gec_import.nil? || %w[completed failed].include?(gec_import.status)
      upload&.destroy
      return
    end

    unless upload
      gec_import.update!(
        status: "failed",
        metadata: (gec_import.metadata || {}).merge({ "stage" => "failed", "progress_percent" => 100, "error" => "Missing upload payload" })
      )
      return
    end

    user = uploaded_by_user_id.present? ? User.find_by(id: uploaded_by_user_id) : nil
    tmp_file_path = nil
    lock_acquired = false
    should_destroy_upload = true

    begin
      if import_type == "full_list"
        lock_result = ActiveRecord::Base.connection.select_value("SELECT pg_try_advisory_lock(#{FULL_LIST_IMPORT_LOCK_KEY_1}, #{FULL_LIST_IMPORT_LOCK_KEY_2})")
        lock_acquired = ActiveModel::Type::Boolean.new.cast(lock_result)
        unless lock_acquired
          Rails.logger.warn("GecImportJob #{gec_import_id}: full_list import lock busy, retrying")
          should_destroy_upload = false
          gec_import.update!(
            status: "pending",
            metadata: (gec_import.metadata || {}).merge({ "stage" => "queued", "progress_percent" => 0, "note" => "Waiting for another full-list import to finish" })
          )
          self.class.set(wait: 30.seconds).perform_later(
            gec_import_id: gec_import_id,
            upload_id: upload_id,
            gec_list_date: gec_list_date,
            uploaded_by_user_id: uploaded_by_user_id,
            sheet_name: sheet_name,
            import_type: import_type
          )
          return
        end
      end

      gec_import.update!(
        status: "processing",
        metadata: (gec_import.metadata || {}).merge({ "stage" => "parsing", "progress_percent" => 5 })
      )

      tmp = Tempfile.new([ "gec_import", ".tmp" ])
      tmp.binmode
      tmp.write(upload.file_data)
      tmp.flush
      tmp_file_path = tmp.path
      tmp.close

      service = GecImportService.new(
        file_path: tmp_file_path,
        gec_list_date: Date.parse(gec_list_date),
        uploaded_by_user: user,
        sheet_name: sheet_name,
        import_type: import_type,
        gec_import: gec_import
      )

      result = service.call

      if result.success
        begin
          AuditLog.create(
            auditable: result.gec_import,
            auditable_type: result.gec_import.class.name,
            actor_user: user,
            action: "gec_import",
            changed_data: result.stats,
            metadata: { entry_mode: "async_import_job" }
          )
        rescue StandardError => e
          Rails.logger.warn("Async import audit log failed for #{gec_import.id}: #{e.message}")
        end
      end
    rescue StandardError => e
      gec_import&.update!(
        status: "failed",
        metadata: (gec_import&.metadata || {}).merge({ "stage" => "failed", "progress_percent" => 100, "error" => e.message })
      )
      Rails.logger.error("GecImportJob failed for #{gec_import_id}: #{e.class}: #{e.message}")
    ensure
      File.delete(tmp_file_path) if tmp_file_path.present? && File.exist?(tmp_file_path)
      upload&.destroy if should_destroy_upload
      if lock_acquired
        begin
          ActiveRecord::Base.connection.execute("SELECT pg_advisory_unlock(#{FULL_LIST_IMPORT_LOCK_KEY_1}, #{FULL_LIST_IMPORT_LOCK_KEY_2})")
        rescue StandardError => e
          Rails.logger.warn("GecImportJob #{gec_import_id}: advisory unlock failed: #{e.class}: #{e.message}")
        end
      end
    end
  end
end
