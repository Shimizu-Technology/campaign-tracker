# frozen_string_literal: true

class GecVoter < ApplicationRecord
  STATUSES = %w[active removed].freeze

  belongs_to :village, optional: true
  belongs_to :removal_detected_by_import, class_name: "GecImport", optional: true

  validates :first_name, presence: true
  validates :last_name, presence: true
  validates :village_name, presence: true
  validates :gec_list_date, presence: true
  validates :status, inclusion: { in: STATUSES }

  before_validation :resolve_village

  scope :active, -> { where(status: "active") }
  scope :removed, -> { where(status: "removed") }
  scope :transferred, -> { where.not(previous_village_name: nil) }
  scope :for_list_date, ->(date) { where(gec_list_date: date) }
  scope :with_ambiguous_dob, -> { where(dob_ambiguous: true) }
  scope :recently_removed, -> { removed.where("removed_at > ?", 60.days.ago) }

  # Find potential matches for a supporter against the GEC voter list.
  # Returns array of hashes: { gec_voter:, confidence:, match_type:, match_count: }
  #
  # Confidence tiers (adapts to whether full DOB or birth_year_only is available):
  #   :exact  — name + full DOB + village → 1 match (legacy, backwards compat)
  #   :exact  — name + birth_year + village → exactly 1 match (new GEC format)
  #   :high   — name + birth_year + village → 2-3 matches (likely correct, note ambiguity)
  #   :high   — name + birth_year, different village → referral candidate
  #   :medium — name + birth_year + village → 4+ matches (too many, manual review)
  #   :medium — fuzzy name + birth_year/DOB
  #   :low    — name + village only (no birth info)
  def self.find_matches(first_name:, last_name:, dob: nil, birth_year: nil, village_name: nil)
    matches = []
    fn = first_name.to_s.downcase.strip
    ln = last_name.to_s.downcase.strip
    vn = village_name.to_s.downcase.strip

    # Derive birth_year from dob if not provided
    effective_birth_year = birth_year || dob&.year

    # --- Strategy 1: Exact name + full DOB + village (legacy/backwards compat) ---
    if dob.present? && village_name.present?
      exact = active
        .where("LOWER(first_name) = ? AND LOWER(last_name) = ?", fn, ln)
        .where(dob: dob)
        .where("LOWER(village_name) = ?", vn)
        .to_a

      if exact.any?
        exact.each do |gv|
          matches << { gec_voter: gv, confidence: :exact, match_type: :exact_dob_village, match_count: exact.size }
        end
        return matches
      end

      # Exact name + full DOB, different village → referral
      diff_village = active
        .where("LOWER(first_name) = ? AND LOWER(last_name) = ?", fn, ln)
        .where(dob: dob)
        .where.not("LOWER(village_name) = ?", vn)
        .to_a

      if diff_village.any?
        diff_village.each do |gv|
          matches << { gec_voter: gv, confidence: :high, match_type: :different_village, match_count: diff_village.size }
        end
        return matches
      end
    end

    # --- Strategy 2: Name + birth_year + village (primary path for new GEC format) ---
    if effective_birth_year.present? && village_name.present?
      name_year_village = active
        .where("LOWER(first_name) = ? AND LOWER(last_name) = ?", fn, ln)
        .where(birth_year: effective_birth_year)
        .where("LOWER(village_name) = ?", vn)
        .to_a

      if name_year_village.any?
        count = name_year_village.size
        confidence = case count
        when 1     then :exact
        when 2, 3  then :high
        else            :medium
        end

        name_year_village.each do |gv|
          matches << { gec_voter: gv, confidence: confidence, match_type: :name_year_village, match_count: count }
        end
        return matches
      end

      # Name + birth_year, different village → referral candidate
      diff_village = active
        .where("LOWER(first_name) = ? AND LOWER(last_name) = ?", fn, ln)
        .where(birth_year: effective_birth_year)
        .where.not("LOWER(village_name) = ?", vn)
        .to_a

      if diff_village.any?
        diff_village.each do |gv|
          matches << { gec_voter: gv, confidence: :high, match_type: :different_village, match_count: diff_village.size }
        end
        return matches
      end
    end

    # --- Strategy 3: Name + birth_year only (no village constraint) ---
    if effective_birth_year.present? && matches.empty?
      name_year = active
        .where("LOWER(first_name) = ? AND LOWER(last_name) = ?", fn, ln)
        .where(birth_year: effective_birth_year)
        .to_a

      if name_year.any?
        name_year.each do |gv|
          matches << { gec_voter: gv, confidence: :medium, match_type: :name_year_only, match_count: name_year.size }
        end
        return matches
      end
    end

    # --- Strategy 4: Fuzzy name + birth_year ---
    if effective_birth_year.present? && matches.empty?
      fuzzy = active
        .where(birth_year: effective_birth_year)
        .where(
          "similarity(LOWER(first_name), ?) > 0.4 AND similarity(LOWER(last_name), ?) > 0.4",
          fn, ln
        )
        .order(Arel.sql(ActiveRecord::Base.sanitize_sql_array([ "similarity(LOWER(last_name), ?) DESC", ln ])))
        .limit(5)
        .to_a

      if fuzzy.any?
        fuzzy.each do |gv|
          matches << { gec_voter: gv, confidence: :medium, match_type: :fuzzy_name_year, match_count: fuzzy.size }
        end
        return matches
      end
    end

    # --- Strategy 5: Name + village only (no birth info — last resort) ---
    if village_name.present? && matches.empty?
      name_village = active
        .where("LOWER(first_name) = ? AND LOWER(last_name) = ?", fn, ln)
        .where("LOWER(village_name) = ?", vn)
        .to_a

      name_village.each do |gv|
        matches << { gec_voter: gv, confidence: :low, match_type: :name_village_only, match_count: name_village.size }
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
