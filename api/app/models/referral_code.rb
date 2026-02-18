class ReferralCode < ApplicationRecord
  belongs_to :assigned_user, class_name: "User", optional: true
  belongs_to :created_by_user, class_name: "User", optional: true
  belongs_to :village

  has_many :supporters, dependent: :nullify

  validates :code, presence: true, uniqueness: true
  validates :display_name, presence: true

  scope :active, -> { where(active: true) }

  def self.generate_unique_code(display_name:, village_name:)
    base_prefix = build_prefix(display_name)
    base_suffix = village_name.to_s.first(3).upcase

    20.times do
      candidate = "#{base_prefix}-#{base_suffix}-#{SecureRandom.hex(2).upcase}"
      return candidate unless exists?(code: candidate)
    end

    100.times do
      candidate = "#{base_prefix}-#{base_suffix}-#{SecureRandom.hex(4).upcase}"
      return candidate unless exists?(code: candidate)
    end

    raise "Unable to generate unique referral code after 120 attempts"
  end

  def self.build_prefix(display_name)
    tokens = display_name.to_s.strip.split(/\s+/).reject(&:blank?)
    return "LEAD" if tokens.empty?

    prefix = tokens.map { |token| token.gsub(/[^A-Za-z0-9]/, "").first(2).to_s.upcase }.join
    prefix = prefix.first(8)
    prefix.present? ? prefix : "LEAD"
  end
  private_class_method :build_prefix
end
