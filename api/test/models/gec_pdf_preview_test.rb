require "test_helper"

class GecPdfPreviewTest < ActiveSupport::TestCase
  test "purge_stale! removes abandoned non-terminal previews and old terminal previews" do
    user = User.create!(
      clerk_id: "clerk-preview-model-test",
      email: "preview-model-test@example.com",
      role: "campaign_admin"
    )

    old_pending = GecPdfPreview.create!(
      preview_request_id: "old-pending-preview",
      uploaded_by_user: user,
      filename: "old-pending.pdf",
      content_type: "application/pdf",
      status: "pending",
      file_data: "%PDF-1.4 sample"
    )
    old_pending.update_columns(updated_at: 2.hours.ago)

    old_completed = GecPdfPreview.create!(
      preview_request_id: "old-completed-preview",
      uploaded_by_user: user,
      filename: "old-completed.pdf",
      content_type: "application/pdf",
      status: "completed",
      file_data: "%PDF-1.4 sample",
      result_data: { "ok" => true }
    )
    old_completed.update_columns(updated_at: 2.days.ago, file_data: nil)

    fresh_processing = GecPdfPreview.create!(
      preview_request_id: "fresh-processing-preview",
      uploaded_by_user: user,
      filename: "fresh-processing.pdf",
      content_type: "application/pdf",
      status: "processing",
      file_data: "%PDF-1.4 sample"
    )
    fresh_processing.update_columns(updated_at: 30.minutes.ago)

    assert_difference("GecPdfPreview.count", -2) do
      GecPdfPreview.purge_stale!
    end

    assert_not GecPdfPreview.exists?(old_pending.id)
    assert_not GecPdfPreview.exists?(old_completed.id)
    assert GecPdfPreview.exists?(fresh_processing.id)
  end
end
