# frozen_string_literal: true

class GecImportJob < ApplicationJob
  queue_as :default

  def perform(gec_import_id:, upload_id:, gec_list_date:, uploaded_by_user_id: nil, sheet_name: nil, import_type: "full_list")
    gec_import = GecImport.find_by(id: gec_import_id)
    return if gec_import.nil? || %w[completed failed].include?(gec_import.status)

    upload = GecImportUpload.find_by(id: upload_id)
    unless upload
      gec_import.update!(
        status: "failed",
        metadata: (gec_import.metadata || {}).merge({ "stage" => "failed", "progress_percent" => 100, "error" => "Missing upload payload" })
      )
      return
    end

    user = uploaded_by_user_id.present? ? User.find_by(id: uploaded_by_user_id) : nil
    tmp_file_path = nil

    begin
      gec_import.update!(
        status: "processing",
        metadata: (gec_import.metadata || {}).merge({ "stage" => "parsing", "progress_percent" => 5 })
      )

      tmp = Tempfile.new([ "gec_import", File.extname(upload.filename.to_s).presence || ".tmp" ])
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
      upload&.destroy
    end
  end
end
