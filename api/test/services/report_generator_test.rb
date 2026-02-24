require "test_helper"

class ReportGeneratorTest < ActiveSupport::TestCase
  setup do
    @village = Village.find_or_create_by!(name: "Barrigada")
    @village2 = Village.find_or_create_by!(name: "Dededo")

    @campaign = Campaign.find_or_create_by!(
      name: "Test Campaign",
      status: "active",
      election_year: 2026
    )

    Quota.find_or_create_by!(campaign: @campaign, village: @village) do |q|
      q.target_count = 100
      q.target_date = Date.new(2026, 8, 1)
      q.period = "monthly"
    end

    # Create verified team-input supporter
    @supporter = Supporter.create!(
      first_name: "Juan",
      last_name: "Cruz",
      contact_number: "671-555-0001",
      dob: Date.new(1985, 3, 15),
      village: @village,
      source: "staff_entry",
      attribution_method: "staff_manual",
      status: "active",
      turnout_status: "unknown",
      verification_status: "verified",
      verified_at: Time.current,
      registered_voter: true
    )

    # Create a referral supporter (wrong village)
    @referral = Supporter.create!(
      first_name: "Ana",
      last_name: "Santos",
      contact_number: "671-555-0002",
      village: @village,
      referred_from_village_id: @village2.id,
      source: "staff_entry",
      attribution_method: "staff_manual",
      status: "active",
      turnout_status: "unknown",
      verification_status: "flagged",
      registered_voter: true
    )

    # GEC voter data
    GecVoter.create!(
      first_name: "Juan",
      last_name: "Cruz",
      dob: Date.new(1985, 3, 15),
      village_name: "Barrigada",
      voter_registration_number: "VR12345",
      gec_list_date: Date.new(2026, 2, 25),
      imported_at: Time.current
    )
  end

  test "generates support list" do
    result = ReportGenerator.new(report_type: "support_list").generate
    assert result[:package].is_a?(Axlsx::Package)
    assert_match(/support-list/, result[:filename])
  end

  test "generates support list filtered by village" do
    result = ReportGenerator.new(report_type: "support_list", village_id: @village.id).generate
    assert result[:package].is_a?(Axlsx::Package)
  end

  test "generates purge list" do
    GecVoter.create!(
      first_name: "Removed",
      last_name: "Voter",
      village_name: "Barrigada",
      status: "removed",
      gec_list_date: Date.new(2026, 1, 25),
      imported_at: Time.current
    )

    result = ReportGenerator.new(report_type: "purge_list").generate
    assert result[:package].is_a?(Axlsx::Package)
    assert_match(/purge-list/, result[:filename])
  end

  test "generates transfer list" do
    result = ReportGenerator.new(report_type: "transfer_list").generate
    assert result[:package].is_a?(Axlsx::Package)
    assert_match(/transfer-list/, result[:filename])
  end

  test "generates referral list" do
    result = ReportGenerator.new(report_type: "referral_list").generate
    assert result[:package].is_a?(Axlsx::Package)
    assert_match(/referral-list/, result[:filename])
  end

  test "generates quota summary" do
    result = ReportGenerator.new(report_type: "quota_summary").generate
    assert result[:package].is_a?(Axlsx::Package)
    assert_match(/quota-summary/, result[:filename])
  end

  test "raises on unknown report type" do
    assert_raises(ArgumentError) do
      ReportGenerator.new(report_type: "nonexistent").generate
    end
  end

  test "purge list handles no GEC data" do
    GecVoter.delete_all
    result = ReportGenerator.new(report_type: "purge_list").generate
    assert result[:package].is_a?(Axlsx::Package)
    assert_match(/purge-list/, result[:filename])
  end
end
