# frozen_string_literal: true

class GecImportJob < ApplicationJob
  queue_as :default

  def perform(gec_import_id:, file_path:, gec_list_date:, uploaded_by_user_id: nil, sheet_name: nil, import_type: "full_list")
    gec_import = GecImport.find(gec_import_id)
    user = uploaded_by_user_id.present? ? User.find_by(id: uploaded_by_user_id) : nil

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
      AuditLog.create!(
        auditable: result.gec_import,
        auditable_type: result.gec_import.class.name,
        actor_user: user,
        action: "gec_import",
        changed_data: result.stats,
        metadata: { entry_mode: "async_import_job" }
      )
    end
  ensure
    File.delete(file_path) if file_path.present? && File.exist?(file_path)
  end
end
