# frozen_string_literal: true

class SmsBlast < ApplicationRecord
  STATUSES = %w[pending sending completed failed].freeze

  belongs_to :initiated_by, class_name: "User", foreign_key: :initiated_by_user_id

  validates :status, inclusion: { in: STATUSES }
  validates :message, presence: true

  scope :recent, -> { order(created_at: :desc).limit(20) }

  def progress_pct
    return 0 if total_recipients.nil? || total_recipients.zero?
    ((sent_count.to_i + failed_count.to_i) * 100.0 / total_recipients).round(1)
  end

  def finished?
    %w[completed failed].include?(status)
  end

  def increment_sent!
    self.class.where(id: id).update_all("sent_count = COALESCE(sent_count, 0) + 1")
  end

  def increment_failed!(error_msg = nil)
    self.class.where(id: id).update_all("failed_count = COALESCE(failed_count, 0) + 1")
    append_error(error_msg) if error_msg
  end

  def append_error(msg)
    current = self.class.where(id: id).pick(:error_log) || []
    current << msg if current.size < 50 # Cap error log
    self.class.where(id: id).update_all([ "error_log = ?", current.to_json ])
  end
end
