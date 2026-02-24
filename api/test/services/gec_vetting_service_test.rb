require "test_helper"

class GecVettingServiceTest < ActiveSupport::TestCase
  setup do
    @village = Village.find_or_create_by!(name: "Barrigada")
    @other_village = Village.find_or_create_by!(name: "Dededo")

    # Create GEC voter records
    @gec_voter = GecVoter.create!(
      first_name: "Juan",
      last_name: "Cruz",
      dob: Date.new(1985, 3, 15),
      village_name: "Barrigada",
      voter_registration_number: "VR12345",
      gec_list_date: Date.new(2026, 2, 25),
      imported_at: Time.current
    )

    GecVoter.create!(
      first_name: "Maria",
      last_name: "Santos",
      dob: Date.new(1990, 6, 20),
      village_name: "Dededo",
      gec_list_date: Date.new(2026, 2, 25),
      imported_at: Time.current
    )
  end

  test "auto-verifies exact match" do
    supporter = create_supporter(first_name: "Juan", last_name: "Cruz", dob: Date.new(1985, 3, 15), village: @village)

    result = GecVettingService.new(supporter).call

    assert_equal :auto_verified, result.status
    supporter.reload
    assert_equal "verified", supporter.verification_status
    assert supporter.registered_voter
  end

  test "flags different village as referral" do
    supporter = create_supporter(first_name: "Juan", last_name: "Cruz", dob: Date.new(1985, 3, 15), village: @other_village)

    result = GecVettingService.new(supporter).call

    assert_equal :referral, result.status
    supporter.reload
    assert_equal "flagged", supporter.verification_status
    assert supporter.registered_voter
    assert_equal @village.id, supporter.referred_from_village_id
  end

  test "marks unregistered when no match" do
    supporter = create_supporter(first_name: "Unknown", last_name: "Person", dob: Date.new(2000, 1, 1), village: @village)

    result = GecVettingService.new(supporter).call

    assert_equal :unregistered, result.status
    supporter.reload
    assert_not supporter.registered_voter
  end

  test "skips when no GEC data loaded" do
    GecVoter.delete_all

    supporter = create_supporter(first_name: "Juan", last_name: "Cruz", village: @village)

    result = GecVettingService.new(supporter).call

    assert_equal :skipped, result.status
  end

  test "auto-vets on supporter creation via callback" do
    supporter = Supporter.create!(
      first_name: "Juan",
      last_name: "Cruz",
      dob: Date.new(1985, 3, 15),
      contact_number: "671-555-0001",
      village: @village,
      source: "staff_entry",
      attribution_method: "staff_manual",
      status: "active",
      turnout_status: "unknown"
    )

    supporter.reload
    assert_equal "verified", supporter.verification_status
    assert supporter.registered_voter
  end

  test "case-insensitive matching" do
    supporter = create_supporter(first_name: "JUAN", last_name: "CRUZ", dob: Date.new(1985, 3, 15), village: @village)

    result = GecVettingService.new(supporter).call

    assert_equal :auto_verified, result.status
  end

  private

  def create_supporter(first_name:, last_name:, village:, dob: nil)
    Supporter.new(
      first_name: first_name,
      last_name: last_name,
      dob: dob,
      contact_number: "671-555-#{rand(1000..9999)}",
      village: village,
      source: "staff_entry",
      attribution_method: "staff_manual",
      status: "active",
      turnout_status: "unknown",
      verification_status: "unverified"
    ).tap { |s| s.save!(validate: true) }
  end
end
