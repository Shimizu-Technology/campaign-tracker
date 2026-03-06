# frozen_string_literal: true

class GecImportJob < ApplicationJob
  queue_as :default

  def perform(gec_import_id:, file_path:, gec_list_date:, uploaded_by_user_id: nil, sheet_name: nil, import_type: "full_list")
    gec_import = GecImport.find_by(id: gec_import_id)
    return if gec_import.nil? || gec_import.status == "completed"

    user = uploaded_by_user_id.present? ? User.find_by(id: uploaded_by_user_id) : nil

    begin
      gec_import.update!(
        status: "processing",
        metadata: (gec_import.metadata || {}).merge({ "stage" => "parsing", "progress_percent" => 5 })
      )

      service = GecImportService.new(
        file_path: file_path,
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
      raise
    ensure
      File.delete(file_path) if file_path.present? && File.exist?(file_path)
    end
  end
end
