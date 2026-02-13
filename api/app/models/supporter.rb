class Supporter < ApplicationRecord
  TURNOUT_STATUSES = %w[unknown not_yet_voted voted].freeze
  TURNOUT_SOURCES = %w[poll_watcher war_room admin_override].freeze

  belongs_to :village
  belongs_to :precinct, optional: true
  belongs_to :block, optional: true
  belongs_to :entered_by, class_name: "User", foreign_key: :entered_by_user_id, optional: true
  belongs_to :turnout_updated_by_user, class_name: "User", optional: true

  has_many :event_rsvps, dependent: :destroy
  has_many :events, through: :event_rsvps
  has_many :audit_logs, as: :auditable, dependent: :destroy
  has_many :supporter_contact_attempts, dependent: :destroy

  validates :print_name, presence: true
  validates :contact_number, presence: true
  validates :status, inclusion: { in: %w[active inactive duplicate unverified] }
  validates :source, inclusion: { in: %w[staff_entry qr_signup referral bulk_import] }, allow_nil: true
  validates :turnout_status, inclusion: { in: TURNOUT_STATUSES }
  validates :turnout_source, inclusion: { in: TURNOUT_SOURCES }, allow_blank: true
  validate :precinct_matches_village
  validate :block_matches_village

  scope :active, -> { where(status: "active") }
  scope :registered_voters, -> { where(registered_voter: true) }
  scope :motorcade_available, -> { where(motorcade_available: true) }
  scope :yard_sign, -> { where(yard_sign: true) }
  scope :today, -> { where("supporters.created_at >= ?", Time.current.beginning_of_day) }
  scope :this_week, -> { where("supporters.created_at >= ?", Time.current.beginning_of_week) }

  def self.potential_duplicates(name, village_id)
    return none if name.blank? || village_id.blank?

    where(village_id: village_id)
      .where("LOWER(print_name) = ?", name.downcase.strip)
      .active
  end

  # Engagement metrics
  def events_invited_count
    event_rsvps.count
  end

  def events_attended_count
    event_rsvps.where(attended: true).count
  end

  def reliability_score
    invited = events_invited_count
    return nil if invited == 0
    ((events_attended_count.to_f / invited) * 100).round(1)
  end

  private

  def precinct_matches_village
    return if precinct.blank? || village_id.blank?
    return if precinct.village_id == village_id

    errors.add(:precinct_id, "must belong to the selected village")
  end

  def block_matches_village
    return if block.blank? || village_id.blank?
    return if block.village_id == village_id

    errors.add(:block_id, "must belong to the selected village")
  end
end
