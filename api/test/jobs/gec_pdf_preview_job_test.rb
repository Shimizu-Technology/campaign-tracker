require "test_helper"

class GecPdfPreviewJobTest < ActiveSupport::TestCase
  test "marks preview failed when file data was already cleared" do
    user = User.create!(
      clerk_id: "clerk-preview-job-test",
      email: "preview-job-test@example.com",
      role: "campaign_admin"
    )

    preview = GecPdfPreview.create!(
      preview_request_id: "preview-job-test",
      uploaded_by_user: user,
      filename: "preview.pdf",
      content_type: "application/pdf",
      status: "pending",
      file_data: "%PDF-1.4 sample"
    )
    preview.update_columns(file_data: nil)

    GecPdfPreviewJob.perform_now(gec_pdf_preview_id: preview.id)

    preview.reload
    assert_equal "failed", preview.status
    assert_equal "PDF data is no longer available; please re-upload the file.", preview.error_message
    assert_equal({}, preview.result_data)
  end
end
