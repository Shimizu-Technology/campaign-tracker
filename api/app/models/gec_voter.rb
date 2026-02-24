# frozen_string_literal: true

class GecVoter < ApplicationRecord
  STATUSES = %w[active removed transferred].freeze

  belongs_to :village, optional: true

  validates :first_name, presence: true
  validates :last_name, presence: true
  validates :village_name, presence: true
  validates :gec_list_date, presence: true
  validates :status, inclusion: { in: STATUSES }

  before_validation :resolve_village

  scope :active, -> { where(status: "active") }
  scope :for_list_date, ->(date) { where(gec_list_date: date) }
  scope :with_ambiguous_dob, -> { where(dob_ambiguous: true) }

  # Find potential matches for a supporter.
  # Returns an array of hashes with :gec_voter, :confidence, :match_type
  def self.find_matches(first_name:, last_name:, dob: nil, village_name: nil)
    matches = []

    # Exact name + DOB + village
    if dob.present? && village_name.present?
      exact = active
        .where("LOWER(first_name) = ? AND LOWER(last_name) = ?", first_name.to_s.downcase.strip, last_name.to_s.downcase.strip)
        .where(dob: dob)
        .where("LOWER(village_name) = ?", village_name.to_s.downcase.strip)

      exact.each do |gv|
        matches << { gec_voter: gv, confidence: :exact, match_type: :exact_match }
      end

      # Exact name + DOB but different village (potential referral)
      if matches.empty?
        diff_village = active
          .where("LOWER(first_name) = ? AND LOWER(last_name) = ?", first_name.to_s.downcase.strip, last_name.to_s.downcase.strip)
          .where(dob: dob)
          .where.not("LOWER(village_name) = ?", village_name.to_s.downcase.strip)

        diff_village.each do |gv|
          matches << { gec_voter: gv, confidence: :high, match_type: :different_village }
        end
      end
    end

    # Exact name + DOB (no village constraint) — fallback
    if matches.empty? && dob.present?
      name_dob = active
        .where("LOWER(first_name) = ? AND LOWER(last_name) = ?", first_name.to_s.downcase.strip, last_name.to_s.downcase.strip)
        .where(dob: dob)

      name_dob.each do |gv|
        matches << { gec_voter: gv, confidence: :high, match_type: :name_dob_only }
      end
    end

    # Fuzzy name match (trigram similarity) + DOB
    if matches.empty? && dob.present?
      fuzzy = active
        .where(dob: dob)
        .where(
          "similarity(LOWER(first_name), ?) > 0.4 AND similarity(LOWER(last_name), ?) > 0.4",
          first_name.to_s.downcase.strip,
          last_name.to_s.downcase.strip
        )
        .order(Arel.sql(ActiveRecord::Base.sanitize_sql_array( [ "similarity(LOWER(last_name), ?) DESC", last_name.to_s.downcase.strip ] )))
        .limit(5)

      fuzzy.each do |gv|
        matches << { gec_voter: gv, confidence: :medium, match_type: :fuzzy_name }
      end
    end

    # Name only (no DOB available)
    if matches.empty? && dob.blank? && village_name.present?
      name_village = active
        .where("LOWER(first_name) = ? AND LOWER(last_name) = ?", first_name.to_s.downcase.strip, last_name.to_s.downcase.strip)
        .where("LOWER(village_name) = ?", village_name.to_s.downcase.strip)

      name_village.each do |gv|
        matches << { gec_voter: gv, confidence: :low, match_type: :name_village_only }
      end
    end

    matches
  end

  private

  def resolve_village
    return if village_id.present? || village_name.blank?

    found = Village.find_by("LOWER(name) = ?", village_name.downcase.strip)
    self.village_id = found&.id
  end
end
