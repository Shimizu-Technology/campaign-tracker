require "test_helper"

class Api::V1::WarRoomControllerTest < ActionDispatch::IntegrationTest
  def setup
    @admin = User.create!(
      clerk_id: "clerk-war-room-admin",
      email: "war-room-admin@example.com",
      name: "War Room Admin",
      role: "campaign_admin"
    )

    @village_a = Village.create!(name: "Village A", region: "North")
    @village_b = Village.create!(name: "Village B", region: "South")
    @precinct_a = Precinct.create!(number: "A-1", village: @village_a, registered_voters: 200)
    @precinct_b = Precinct.create!(number: "B-1", village: @village_b, registered_voters: 180)

    PollReport.create!(precinct: @precinct_a, voter_count: 60, report_type: "turnout_update", reported_at: Time.current)
    PollReport.create!(precinct: @precinct_b, voter_count: 30, report_type: "turnout_update", reported_at: Time.current)

    @supporter_a1 = Supporter.create!(
      print_name: "Supporter A1",
      contact_number: "6715552101",
      village: @village_a,
      precinct: @precinct_a,
      source: "staff_entry",
      status: "active",
      turnout_status: "not_yet_voted"
    )
    @supporter_a2 = Supporter.create!(
      print_name: "Supporter A2",
      contact_number: "6715552102",
      village: @village_a,
      precinct: @precinct_a,
      source: "staff_entry",
      status: "active",
      turnout_status: "voted"
    )
    @supporter_b1 = Supporter.create!(
      print_name: "Supporter B1",
      contact_number: "6715552201",
      village: @village_b,
      precinct: @precinct_b,
      source: "staff_entry",
      status: "active",
      turnout_status: "not_yet_voted"
    )

    SupporterContactAttempt.create!(
      supporter: @supporter_a1,
      recorded_by_user: @admin,
      outcome: "attempted",
      channel: "call",
      recorded_at: Time.current
    )
    SupporterContactAttempt.create!(
      supporter: @supporter_b1,
      recorded_by_user: @admin,
      outcome: "reached",
      channel: "call",
      recorded_at: Time.current
    )
  end

  test "returns war room queue and outreach metrics" do
    get "/api/v1/war_room", headers: auth_headers(@admin)

    assert_response :success
    payload = JSON.parse(response.body)

    assert_equal 2, payload.dig("stats", "total_not_yet_voted")
    assert_equal 1, payload.dig("stats", "total_outreach_attempted")
    assert_equal 1, payload.dig("stats", "total_outreach_reached")
    assert payload["not_yet_voted_queue"].is_a?(Array)
    assert payload["not_yet_voted_queue"].any? { |entry| entry["name"] == "Village A" }

    village_a = payload["villages"].find { |v| v["name"] == "Village A" }
    assert_equal 1, village_a["not_yet_voted_count"]
    assert_equal 1, village_a["outreach_attempted_count"]
    assert_equal 0, village_a["outreach_reached_count"]
  end
end
