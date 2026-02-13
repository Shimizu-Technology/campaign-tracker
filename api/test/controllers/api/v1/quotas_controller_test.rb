require "test_helper"

class Api::V1::QuotasControllerTest < ActionDispatch::IntegrationTest
  def setup
    @campaign = Campaign.create!(
      name: "Test Campaign",
      election_year: 2026,
      status: "active"
    )
    @village = Village.create!(
      name: "Tamuning",
      region: "Central",
      registered_voters: 1234,
      precinct_count: 1
    )
    @quota = Quota.create!(
      campaign: @campaign,
      village: @village,
      period: "quarterly",
      target_count: 250
    )
    @admin = User.create!(
      clerk_id: "clerk-admin-quota",
      email: "quota-admin@example.com",
      name: "Quota Admin",
      role: "campaign_admin"
    )
    @coordinator = User.create!(
      clerk_id: "clerk-coordinator-quota",
      email: "quota-coordinator@example.com",
      name: "Quota Coordinator",
      role: "district_coordinator"
    )
    @leader = User.create!(
      clerk_id: "clerk-leader-quota",
      email: "quota-leader@example.com",
      name: "Quota Leader",
      role: "block_leader"
    )
  end

  test "non coordinator cannot access quotas index" do
    get "/api/v1/quotas", headers: auth_headers(@leader)

    assert_response :forbidden
    payload = JSON.parse(response.body)
    assert_equal "coordinator_access_required", payload["code"]
  end

  test "coordinator can list quotas" do
    get "/api/v1/quotas", headers: auth_headers(@coordinator)

    assert_response :success
    payload = JSON.parse(response.body)
    row = payload["quotas"].find { |q| q["village_id"] == @village.id }
    assert_not_nil row
    assert_equal 250, row["target_count"]
  end

  test "admin can update existing quota and audit is written" do
    patch "/api/v1/quotas/#{@village.id}",
      params: { quota: { target_count: 375, change_note: "Adjusted weekly goal" } },
      headers: auth_headers(@admin)

    assert_response :success
    assert_equal 375, @quota.reload.target_count
    audit = AuditLog.where(auditable: @quota).order(created_at: :desc).first
    assert_not_nil audit
    assert_equal "updated", audit.action
    assert_equal 250, audit.changed_data.dig("target_count", "from")
    assert_equal 375, audit.changed_data.dig("target_count", "to")
    assert_equal @admin.id, audit.actor_user_id
    assert_equal "Adjusted weekly goal", audit.metadata["change_note"]
  end

  test "admin can create village quota when missing" do
    village = Village.create!(
      name: "Dededo",
      region: "North",
      registered_voters: 2222,
      precinct_count: 1
    )

    assert_difference -> { Quota.count }, +1 do
      patch "/api/v1/quotas/#{village.id}",
        params: { quota: { target_count: 420 } },
        headers: auth_headers(@admin)
    end

    assert_response :success
    quota = Quota.find_by!(campaign: @campaign, village: village)
    assert_equal 420, quota.target_count
    assert_equal "quarterly", quota.period
  end

  test "invalid target_count is rejected" do
    patch "/api/v1/quotas/#{@village.id}",
      params: { quota: { target_count: 0 } },
      headers: auth_headers(@admin)

    assert_response :unprocessable_entity
    payload = JSON.parse(response.body)
    assert_equal "invalid_quota_target", payload["code"]
  end
end
