require "test_helper"

class Api::V1::ReportsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @village = Village.find_or_create_by!(name: "Barrigada")
    @admin = User.create!(
      clerk_id: "clerk-report-admin-#{SecureRandom.hex(4)}",
      email: "report-admin-#{SecureRandom.hex(4)}@example.com",
      name: "Report Admin",
      role: "campaign_admin"
    )

    Supporter.create!(
      first_name: "Test",
      last_name: "Supporter",
      contact_number: "671-555-9999",
      village: @village,
      source: "staff_entry",
      attribution_method: "staff_manual",
      status: "active",
      turnout_status: "unknown",
      verification_status: "verified",
      verified_at: Time.current,
      registered_voter: true
    )
  end

  test "index returns available reports" do
    get "/api/v1/reports", headers: auth_headers(@admin)

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal 5, json["available_reports"].size
    assert json["quick_stats"]["total_active"] >= 1
  end

  test "show generates support list xlsx" do
    get "/api/v1/reports/support_list", headers: auth_headers(@admin)

    assert_response :success
    assert_equal "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", response.content_type
    assert_match(/support-list/, response.headers["Content-Disposition"])
  end

  test "show generates quota summary xlsx" do
    get "/api/v1/reports/quota_summary", headers: auth_headers(@admin)

    assert_response :success
    assert_equal "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", response.content_type
  end

  test "show filters by village" do
    get "/api/v1/reports/support_list", params: { village_id: @village.id }, headers: auth_headers(@admin)

    assert_response :success
    assert_equal "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", response.content_type
  end

  test "show rejects invalid report type" do
    get "/api/v1/reports/nonexistent", headers: auth_headers(@admin)

    assert_response :unprocessable_entity
  end

  test "requires authentication" do
    get "/api/v1/reports"

    assert_response :unauthorized
  end

  test "requires coordinator role" do
    block_leader = User.create!(
      clerk_id: "clerk-report-bl-#{SecureRandom.hex(4)}",
      email: "report-bl-#{SecureRandom.hex(4)}@example.com",
      name: "Block Leader",
      role: "block_leader"
    )

    get "/api/v1/reports", headers: auth_headers(block_leader)

    assert_response :forbidden
  end
end
