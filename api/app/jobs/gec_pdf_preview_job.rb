# frozen_string_literal: true

class GecPdfPreviewJob < ApplicationJob
  queue_as :default

  def perform(gec_pdf_preview_id:)
    preview = GecPdfPreview.find_by(id: gec_pdf_preview_id)
    return unless preview
    return if preview.completed? || preview.failed?
    source_data = pdf_preview_source_data(preview)
    return preview.update!(
      status: "failed",
      error_message: "PDF data is no longer available; please re-upload the file.",
      result_data: {},
      file_data: nil,
      file_s3_key: nil
    ) if source_data.nil?

    preview.update!(status: "processing", error_message: nil)

    temp = Tempfile.new([ "gec_pdf_preview", ".pdf" ])
    temp.binmode
    temp.write(source_data)
    temp.flush

    parsed = GecPdfParserService.new(file_path: temp.path).parse_preview_sample
    if parsed.errors.any?
      preview.update!(
        status: "failed",
        error_message: parsed.errors.first,
        result_data: {},
        file_data: nil,
        file_s3_key: nil
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
      file_data: nil,
      file_s3_key: nil
    )
  rescue StandardError => e
    preview&.update!(
      status: "failed",
      error_message: e.message,
      result_data: {},
      file_data: nil,
      file_s3_key: nil
    ) unless preview&.completed? || preview&.failed?
    raise
  ensure
    temp&.close!
  end

  private

  def pdf_preview_source_data(preview)
    return preview.file_data if preview.file_data.present?
    return nil if preview.file_s3_key.blank?

    S3Service.download(preview.file_s3_key)
  end
end
