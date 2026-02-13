require "test_helper"

class Api::V1::SessionControllerTest < ActionDispatch::IntegrationTest
  def setup
    @admin = User.create!(
      clerk_id: "clerk-session-admin",
      email: "session-admin@example.com",
      name: "Session Admin",
      role: "campaign_admin"
    )
    @poll_watcher = User.create!(
      clerk_id: "clerk-session-pw",
      email: "session-pw@example.com",
      name: "Session Poll Watcher",
      role: "poll_watcher"
    )
  end

  test "admin session permissions include management tools" do
    get "/api/v1/session", headers: auth_headers(@admin)

    assert_response :success
    payload = JSON.parse(response.body)
    assert_equal true, payload.dig("permissions", "can_manage_users")
    assert_equal true, payload.dig("permissions", "can_send_sms")
    assert_equal true, payload.dig("permissions", "can_access_events")
  end

  test "poll watcher session permissions are restricted to election-day tools" do
    get "/api/v1/session", headers: auth_headers(@poll_watcher)

    assert_response :success
    payload = JSON.parse(response.body)
    assert_equal false, payload.dig("permissions", "can_manage_users")
    assert_equal false, payload.dig("permissions", "can_view_supporters")
    assert_equal true, payload.dig("permissions", "can_access_poll_watcher")
    assert_equal true, payload.dig("permissions", "can_access_war_room")
  end
end
