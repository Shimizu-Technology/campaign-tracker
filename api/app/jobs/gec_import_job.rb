# frozen_string_literal: true

class GecImportJob < ApplicationJob
  queue_as :default

  def perform(gec_import_id:, file_path:, gec_list_date:, uploaded_by_user_id: nil, sheet_name: nil, import_type: "full_list")
    gec_import = GecImport.find(gec_import_id)
    user = uploaded_by_user_id.present? ? User.find_by(id: uploaded_by_user_id) : nil

    service = GecImportService.new(
      file_path: file_path,
      gec_list_date: Date.parse(gec_list_date),
      uploaded_by_user: user,
      sheet_name: sheet_name,
      import_type: import_type,
      gec_import: gec_import
    )

    service.call
  ensure
    File.delete(file_path) if file_path.present? && File.exist?(file_path)
  end
end
