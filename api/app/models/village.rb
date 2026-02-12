class Village < ApplicationRecord
  belongs_to :district, optional: true
  has_many :precincts, dependent: :destroy
  has_many :blocks, dependent: :destroy
  has_many :supporters, dependent: :destroy
  has_many :quotas, dependent: :destroy
  has_many :events, dependent: :nullify

  validates :name, presence: true, uniqueness: true

  def supporter_count
    supporters.active.count
  end

  def quota_progress(campaign_id = nil)
    quota = quotas.where(campaign_id: campaign_id).order(target_date: :desc).first
    return nil unless quota
    { target: quota.target_count, current: supporter_count, percentage: quota.target_count > 0 ? (supporter_count * 100.0 / quota.target_count).round(1) : 0 }
  end
end
