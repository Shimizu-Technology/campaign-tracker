# frozen_string_literal: true

class QuotaPeriod < ApplicationRecord
  STATUSES = %w[open submitted closed].freeze

  belongs_to :campaign_cycle
  has_many :village_quotas, dependent: :destroy
  has_many :supporters

  validates :name, presence: true
  validates :start_date, presence: true
  validates :end_date, presence: true
  validates :due_date, presence: true
  validates :quota_target, numericality: { greater_than_or_equal_to: 0 }
  validates :status, inclusion: { in: STATUSES }

  scope :open, -> { where(status: "open") }
  scope :current, -> { where("start_date <= ? AND end_date >= ?", Date.current, Date.current) }
  scope :upcoming, -> { where("start_date > ?", Date.current).order(:start_date) }
  scope :past, -> { where("end_date < ?", Date.current).order(start_date: :desc) }

  # Count quota-eligible supporters for this period
  def eligible_count
    Supporter.active
      .where(quota_period_id: id)
      .team_input
      .where(verification_status: "verified")
      .count
  end

  # Count all supporters assigned to this period
  def total_assigned
    Supporter.active.where(quota_period_id: id).count
  end

  # Per-village breakdown
  def village_breakdown
    village_quotas.includes(:village).map do |vq|
      eligible = Supporter.active
        .where(quota_period_id: id, village_id: vq.village_id)
        .team_input
        .where(verification_status: "verified")
        .count

      {
        village_id: vq.village_id,
        village_name: vq.village&.name,
        target: vq.target,
        eligible: eligible,
        progress_pct: vq.target > 0 ? (eligible * 100.0 / vq.target).round(1) : 0
      }
    end
  end

  # Snapshot counts at submission time
  def submit!
    breakdown = village_breakdown
    village_quotas.each do |vq|
      entry = breakdown.find { |b| b[:village_id] == vq.village_id }
      vq.update!(submitted_count: entry ? entry[:eligible] : 0)
    end

    update!(
      status: "submitted",
      submission_summary: {
        submitted_at: Time.current.iso8601,
        total_eligible: eligible_count,
        total_assigned: total_assigned,
        village_breakdown: breakdown
      }
    )
  end

  # Days until due
  def days_until_due
    (due_date - Date.current).to_i
  end

  def overdue?
    status == "open" && Date.current > due_date
  end

  def due_soon?
    status == "open" && days_until_due.between?(0, 7)
  end
end
