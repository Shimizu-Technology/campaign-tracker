require "test_helper"

class Api::V1::VillagesControllerTest < ActionDispatch::IntegrationTest
  def setup
    @village = Village.create!(
      name: "Tamuning",
      region: "Central",
      registered_voters: 1234,
      precinct_count: 1
    )
    @coordinator = User.create!(
      clerk_id: "clerk-coordinator-village",
      email: "coordinator-village@example.com",
      name: "Coordinator",
      role: "district_coordinator"
    )
    @leader = User.create!(
      clerk_id: "clerk-leader-village",
      email: "leader-village@example.com",
      name: "Leader",
      role: "block_leader"
    )
  end

  test "non coordinator cannot update village registered voters" do
    patch "/api/v1/villages/#{@village.id}",
      params: { village: { registered_voters: 1500 } },
      headers: auth_headers(@leader)

    assert_response :forbidden
    payload = JSON.parse(response.body)
    assert_equal "coordinator_access_required", payload["code"]
  end

  test "coordinator can update village registered voters and audit is written" do
    patch "/api/v1/villages/#{@village.id}",
      params: { village: { registered_voters: 1500, change_note: "GEC refresh" } },
      headers: auth_headers(@coordinator)

    assert_response :success
    assert_equal 1500, @village.reload.registered_voters
    audit = AuditLog.where(auditable: @village).order(created_at: :desc).first
    assert_not_nil audit
    assert_equal "updated", audit.action
    assert_equal 1234, audit.changed_data.dig("registered_voters", "from")
    assert_equal 1500, audit.changed_data.dig("registered_voters", "to")
    assert_equal "GEC refresh", audit.metadata["change_note"]
  end

  test "invalid registered voters is rejected for village update" do
    patch "/api/v1/villages/#{@village.id}",
      params: { village: { registered_voters: 0 } },
      headers: auth_headers(@coordinator)

    assert_response :unprocessable_entity
    payload = JSON.parse(response.body)
    assert_equal "invalid_registered_voters", payload["code"]
  end
end
