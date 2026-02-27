# frozen_string_literal: true

# Automatically vets a supporter against the GEC voter registration list.
# Called after supporter creation to set verification_status and registered_voter.
#
# Results:
#   - :auto_verified  — exact match found, supporter auto-verified
#   - :flagged        — fuzzy or ambiguous match, needs manual review
#   - :referral       — matched but in a different village
#   - :unregistered   — no match found in GEC list
#   - :skipped        — no GEC data loaded yet
class GecVettingService
  Result = Struct.new(:status, :matches, :gec_voter, :details, :match_count, keyword_init: true)

  def initialize(supporter)
    @supporter = supporter
  end

  def call
    return Result.new(status: :skipped, matches: [], match_count: 0, details: "No GEC voter data loaded") if GecVoter.active.none?

    # birth_year: derive from dob if available (supporters store full DOB if provided at signup)
    supporter_birth_year = @supporter.respond_to?(:birth_year) ? @supporter.birth_year : nil
    supporter_birth_year ||= @supporter.dob&.year

    matches = GecVoter.find_matches(
      first_name: @supporter.first_name,
      last_name: @supporter.last_name,
      dob: @supporter.dob,
      birth_year: supporter_birth_year,
      village_name: @supporter.village&.name
    )

    if matches.empty?
      apply_unregistered!
      return Result.new(status: :unregistered, matches: [], match_count: 0, details: "No match found in GEC voter list")
    end

    best = matches.first
    count = best[:match_count] || matches.size

    case best[:confidence]
    when :exact
      apply_auto_verified!(best[:gec_voter])
      Result.new(
        status: :auto_verified, matches: matches, gec_voter: best[:gec_voter], match_count: count,
        details: "Exact match: #{best[:gec_voter].first_name} #{best[:gec_voter].last_name}, #{best[:gec_voter].village_name}"
      )
    when :high
      if best[:match_type] == :different_village
        apply_referral!(best[:gec_voter])
        Result.new(
          status: :referral, matches: matches, gec_voter: best[:gec_voter], match_count: count,
          details: "Registered in #{best[:gec_voter].village_name}, not #{@supporter.village&.name}"
        )
      else
        apply_auto_verified!(best[:gec_voter])
        detail = count > 1 ? "High confidence match (#{count} candidates, best selected)" : "High confidence match"
        Result.new(
          status: :auto_verified, matches: matches, gec_voter: best[:gec_voter], match_count: count,
          details: "#{detail}: #{best[:gec_voter].first_name} #{best[:gec_voter].last_name}"
        )
      end
    when :medium
      apply_flagged!(best[:gec_voter])
      detail = best[:match_type] == :fuzzy_name_year ? "Fuzzy name match — needs manual review" :
               "#{count} possible matches with same birth year — needs manual review"
      Result.new(
        status: :flagged, matches: matches, gec_voter: best[:gec_voter], match_count: count,
        details: detail
      )
    when :low
      apply_flagged!(best[:gec_voter])
      Result.new(
        status: :flagged, matches: matches, gec_voter: best[:gec_voter], match_count: count,
        details: "Low confidence match (name + village only, no birth year)"
      )
    else
      apply_flagged!(best[:gec_voter])
      Result.new(
        status: :flagged, matches: matches, gec_voter: best[:gec_voter], match_count: count,
        details: "Unknown confidence level"
      )
    end
  end

  private

  def apply_auto_verified!(gec_voter)
    @supporter.update_columns(
      verification_status: "verified",
      verified_at: Time.current,
      registered_voter: true
    )
  end

  def apply_flagged!(gec_voter)
    @supporter.update_columns(
      verification_status: "flagged",
      registered_voter: true
    )
  end

  def apply_referral!(gec_voter)
    referred_village = Village.find_by("LOWER(name) = ?", gec_voter.village_name.downcase.strip)
    @supporter.update_columns(
      verification_status: "flagged",
      registered_voter: true,
      referred_from_village_id: referred_village&.id
    )
  end

  def apply_unregistered!
    @supporter.update_columns(
      registered_voter: false
    )
  end
end
