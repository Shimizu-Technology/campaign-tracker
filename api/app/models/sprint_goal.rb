# frozen_string_literal: true

class SprintGoal < ApplicationRecord
  belongs_to :campaign
  belongs_to :village, optional: true

  validates :title, presence: true
  validates :target_count, presence: true, numericality: { greater_than: 0 }
  validates :current_count, numericality: { greater_than_or_equal_to: 0 }
  validates :start_date, presence: true
  validates :end_date, presence: true
  validates :period_type, inclusion: { in: %w[weekly monthly custom] }
  validates :status, inclusion: { in: %w[active completed expired] }
  validate :end_date_after_start_date

  scope :active, -> { where(status: "active") }
  scope :completed, -> { where(status: "completed") }
  scope :expired, -> { where(status: "expired") }
  scope :current, -> { active.where("start_date <= ? AND end_date >= ?", Date.current, Date.current) }

  def progress_percentage
    return 0 if target_count.zero?
    [ (current_count * 100.0 / target_count).round(1), 100.0 ].min
  end

  private

  def end_date_after_start_date
    return unless start_date && end_date
    errors.add(:end_date, "must be after start date") if end_date <= start_date
  end
end
