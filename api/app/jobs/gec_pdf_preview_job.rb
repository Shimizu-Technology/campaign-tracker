# frozen_string_literal: true

class GecPdfPreviewJob < ApplicationJob
  queue_as :default

  def perform(gec_pdf_preview_id:)
    preview = GecPdfPreview.find_by(id: gec_pdf_preview_id)
    return unless preview
    return if preview.completed?

    preview.update!(status: "processing", error_message: nil)

    temp = Tempfile.new([ "gec_pdf_preview", ".pdf" ])
    temp.binmode
    temp.write(preview.file_data.to_s)
    temp.flush

    parsed = GecPdfParserService.new(file_path: temp.path).parse_preview_sample
    if parsed.errors.any?
      preview.update!(
        status: "failed",
        error_message: parsed.errors.first,
        result_data: {},
        file_data: nil
      )
      return
    end

    preview.update!(
      status: "completed",
      error_message: nil,
      result_data: {
        "qa" => parsed.qa,
        "warnings" => parsed.warnings,
        "row_count" => parsed.rows.size,
        "preview_rows" => parsed.rows.first(100)
      },
      file_data: nil
    )
  ensure
    temp&.close!
  end
end
