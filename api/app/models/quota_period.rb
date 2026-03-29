# frozen_string_literal: true

class QuotaPeriod < ApplicationRecord
  belongs_to :campaign_cycle
  has_many :village_quotas, dependent: :destroy

  validates :due_date, presence: true
  validates :status, inclusion: { in: %w[active submitted] }

  def village_breakdown
    eligible_by_village = eligible_supporters.group(:village_id).count
    deficits = prior_period_deficits

    village_quotas.includes(:village).map do |vq|
      eligible = eligible_by_village[vq.village_id] || 0
      deficit = deficits[vq.village_id] || 0

      {
        village_id: vq.village_id,
        village_name: vq.village&.name,
        target: vq.target,
        eligible: eligible,
        progress_pct: vq.target > 0 ? (eligible * 100.0 / vq.target).round(1) : 0,
        prior_deficit: deficit,
        effective_target: vq.target + deficit
      }
    end
  end

  # Returns cumulative deficit per village from all prior submitted periods in same cycle
  # deficit = how many short each village was. Positive number means they missed quota.
  def prior_period_deficits
    prior_periods = campaign_cycle.quota_periods
      .includes(:village_quotas)
      .where(status: "submitted")
      .where("due_date < ?", due_date)

    deficit_by_village = Hash.new(0)
    prior_periods.each do |pp|
      pp.village_quotas.each do |vq|
        shortfall = vq.target - vq.submitted_count
        deficit_by_village[vq.village_id] += shortfall if shortfall > 0
      end
    end
    deficit_by_village
  end

  private

  def eligible_supporters
    Supporter.active.verified
  end
end
