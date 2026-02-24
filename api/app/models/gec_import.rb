# frozen_string_literal: true

class GecImport < ApplicationRecord
  STATUSES = %w[pending processing completed failed].freeze

  belongs_to :uploaded_by_user, class_name: "User", optional: true

  validates :gec_list_date, presence: true
  validates :filename, presence: true
  validates :status, inclusion: { in: STATUSES }

  scope :latest, -> { order(gec_list_date: :desc) }
  scope :completed, -> { where(status: "completed") }
end
