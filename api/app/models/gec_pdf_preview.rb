# frozen_string_literal: true

class GecPdfPreview < ApplicationRecord
  STATUSES = %w[pending processing completed failed].freeze
  RETENTION_WINDOW = 1.day
  NON_TERMINAL_RETENTION_WINDOW = 1.hour

  belongs_to :uploaded_by_user, class_name: "User"

  validates :preview_request_id, presence: true, uniqueness: true
  validates :filename, presence: true
  validates :status, inclusion: { in: STATUSES }
  validates :file_data, presence: true, on: :create

  scope :stale, lambda {
    where(status: %w[completed failed]).where("updated_at < ?", RETENTION_WINDOW.ago)
      .or(where(status: %w[pending processing]).where("updated_at < ?", NON_TERMINAL_RETENTION_WINDOW.ago))
  }

  def completed?
    status == "completed"
  end

  def failed?
    status == "failed"
  end

  def queued?
    %w[pending processing].include?(status)
  end

  def self.purge_stale!
    stale.delete_all
  end
end
