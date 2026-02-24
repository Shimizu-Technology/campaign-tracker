# frozen_string_literal: true

require "test_helper"

class QuotaPeriodTest < ActiveSupport::TestCase
  setup do
    @cycle = CampaignCycle.create!(
      name: "2026 Primary", cycle_type: "primary",
      start_date: Date.new(2026, 1, 1), end_date: Date.new(2026, 12, 31)
    )
    @period = QuotaPeriod.create!(
      campaign_cycle: @cycle, name: "February 2026",
      start_date: Date.new(2026, 2, 1), end_date: Date.new(2026, 2, 28),
      due_date: Date.new(2026, 2, 23), quota_target: 6000
    )
    @village = Village.find_or_create_by!(name: "Barrigada")
  end

  test "eligible_count returns verified team input supporters in period" do
    s = Supporter.create!(
      first_name: "Juan", last_name: "Cruz", village: @village,
      contact_number: "671-555-0001", source: "staff_entry",
      status: "active", quota_period: @period
    )
    s.update_columns(verification_status: "verified")

    assert_equal 1, @period.eligible_count
  end

  test "submit snapshots counts" do
    VillageQuota.create!(quota_period: @period, village: @village, target: 300)

    @period.submit!
    @period.reload

    assert_equal "submitted", @period.status
    assert @period.submission_summary["submitted_at"].present?
  end

  test "overdue and due_soon" do
    past_period = QuotaPeriod.create!(
      campaign_cycle: @cycle, name: "January 2026",
      start_date: Date.new(2026, 1, 1), end_date: Date.new(2026, 1, 31),
      due_date: 1.week.ago.to_date, quota_target: 6000
    )

    assert past_period.overdue?

    future_period = QuotaPeriod.create!(
      campaign_cycle: @cycle, name: "December 2026",
      start_date: Date.new(2026, 12, 1), end_date: Date.new(2026, 12, 31),
      due_date: Date.new(2026, 12, 23), quota_target: 6000
    )
    refute future_period.overdue?
  end

  test "village_breakdown returns per-village data" do
    VillageQuota.create!(quota_period: @period, village: @village, target: 300)

    breakdown = @period.village_breakdown
    assert_equal 1, breakdown.size
    assert_equal "Barrigada", breakdown.first[:village_name]
    assert_equal 300, breakdown.first[:target]
    assert_equal 0, breakdown.first[:eligible]
  end
end
