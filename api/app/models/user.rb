class User < ApplicationRecord
  ROLES = %w[campaign_admin district_coordinator village_chief block_leader poll_watcher].freeze

  has_many :entered_supporters, class_name: "Supporter", foreign_key: :entered_by_user_id, dependent: :nullify

  validates :clerk_id, presence: true, uniqueness: true
  validates :email, presence: true, uniqueness: true
  validates :role, inclusion: { in: ROLES }

  scope :admins, -> { where(role: "campaign_admin") }
  scope :coordinators, -> { where(role: "district_coordinator") }
  scope :chiefs, -> { where(role: "village_chief") }
  scope :leaders, -> { where(role: "block_leader") }

  def admin?
    role == "campaign_admin"
  end

  def coordinator?
    role == "district_coordinator"
  end

  def chief?
    role == "village_chief"
  end

  def leader?
    role == "block_leader"
  end

  def poll_watcher?
    role == "poll_watcher"
  end

  def can_manage_users?
    admin? || coordinator?
  end
end
