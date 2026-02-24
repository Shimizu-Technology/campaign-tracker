# frozen_string_literal: true

class GecImport < ApplicationRecord
  STATUSES = %w[pending processing completed failed].freeze
  IMPORT_TYPES = %w[full_list changes_only].freeze

  belongs_to :uploaded_by_user, class_name: "User", optional: true

  validates :gec_list_date, presence: true
  validates :filename, presence: true
  validates :status, inclusion: { in: STATUSES }
  validates :import_type, inclusion: { in: IMPORT_TYPES }

  scope :latest, -> { order(gec_list_date: :desc) }
  scope :completed, -> { where(status: "completed") }

  def change_summary
    {
      total_records: total_records,
      new_records: new_records,
      updated_records: updated_records,
      removed_records: removed_records,
      transferred_records: transferred_records,
      ambiguous_dob_count: ambiguous_dob_count,
      re_vetted_count: re_vetted_count,
      import_type: import_type
    }
  end
end
