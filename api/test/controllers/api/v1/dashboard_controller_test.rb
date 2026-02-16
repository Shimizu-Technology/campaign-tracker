require "test_helper"

class Api::V1::DashboardControllerTest < ActionDispatch::IntegrationTest
  def setup
    @user = User.create!(
      clerk_id: "clerk-dashboard-user",
      email: "dashboard-user@example.com",
      name: "Dashboard User",
      role: "campaign_admin"
    )

    @campaign = Campaign.create!(
      name: "Dashboard Campaign",
      election_year: Date.current.year,
      status: "active"
    )

    @village = Village.create!(name: "Dashboard Village", region: "Central")
    Precinct.create!(number: "D1", village: @village)
    Quota.create!(village: @village, campaign: @campaign, period: "quarterly", target_count: 100, target_date: Date.current)

    Supporter.create!(
      first_name: "Supporter", last_name: "One", print_name: "Supporter One",
      contact_number: "6715551000",
      village: @village,
      source: "staff_entry",
      status: "active"
    )
    Supporter.create!(
      first_name: "Supporter", last_name: "Two", print_name: "Supporter Two",
      contact_number: "6715551001",
      village: @village,
      source: "staff_entry",
      status: "active"
    )
  end

  test "show returns aggregated dashboard payload" do
    get "/api/v1/dashboard", headers: auth_headers(@user)

    assert_response :success
    payload = JSON.parse(response.body)

    assert_equal "Dashboard Campaign", payload.dig("campaign", "name")
    assert_equal 2, payload.dig("summary", "total_supporters")
    assert_equal 2, payload.dig("summary", "today_signups")
    assert_equal 2, payload.dig("summary", "week_signups")
    assert_equal 1, payload["villages"].size
    assert_equal 2, payload["villages"][0]["supporter_count"]
    assert_equal 100, payload["villages"][0]["quota_target"]
  end
end
