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

  validates :first_name, presence: true
  validates :last_name, presence: true
  validates :contact_number, presence: true

  # Keep print_name in sync as "Last, First" for display and backward compatibility
  before_validation :sync_print_name

  def display_name
    [first_name, last_name].compact_blank.join(" ")
  end
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

  def self.potential_duplicates(name, village_id, first_name: nil, last_name: nil)
    return none if village_id.blank?

    scope = where(village_id: village_id).active

    if first_name.present? && last_name.present?
      scope.where("LOWER(first_name) = ? AND LOWER(last_name) = ?", first_name.downcase.strip, last_name.downcase.strip)
    elsif name.present?
      scope.where("LOWER(print_name) = ?", name.downcase.strip)
    else
      none
    end
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

  def sync_print_name
    # If first/last are blank but print_name was provided, auto-split for backward compatibility
    if first_name.blank? && last_name.blank? && print_name.present?
      if print_name.include?(",")
        # "Last, First" format
        parts = print_name.split(",", 2).map(&:strip)
        self.last_name = parts[0]
        self.first_name = parts[1]
      else
        # "First Last" format
        parts = print_name.strip.split(/\s+/, 2)
        self.first_name = parts[0]
        self.last_name = parts[1] || parts[0]
      end
    end

    # Keep print_name in sync from first/last
    if first_name.present? && last_name.present?
      self.print_name = "#{last_name}, #{first_name}"
    elsif last_name.present?
      self.print_name = last_name
    elsif first_name.present?
      self.print_name = first_name
    end
  end

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
