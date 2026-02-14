require "test_helper"

class Api::V1::PollWatcherControllerTest < ActionDispatch::IntegrationTest
  def setup
    campaign = Campaign.create!(name: "Poll Watcher Campaign", election_year: Date.current.year, status: "active")
    district_one = District.create!(campaign: campaign, name: "District 1", number: 1)
    district_two = District.create!(campaign: campaign, name: "District 2", number: 2)

    @village_one = Village.create!(name: "Village One")
    @village_two = Village.create!(name: "Village Two")
    @village_one.update!(district: district_one)
    @village_two.update!(district: district_two)

    @precinct_one = Precinct.create!(number: "1", village: @village_one, registered_voters: 100)
    @precinct_two = Precinct.create!(number: "2", village: @village_two, registered_voters: 100)

    @watcher = User.create!(
      clerk_id: "clerk-watcher",
      email: "watcher@example.com",
      name: "Watcher",
      role: "poll_watcher",
      assigned_village_id: @village_one.id
    )
    @chief = User.create!(
      clerk_id: "clerk-chief",
      email: "chief@example.com",
      name: "Village Chief",
      role: "village_chief",
      assigned_village_id: @village_one.id
    )
    @coordinator = User.create!(
      clerk_id: "clerk-coordinator",
      email: "coordinator@example.com",
      name: "District Coordinator",
      role: "district_coordinator",
      assigned_district_id: district_one.id
    )
    @block_leader = User.create!(
      clerk_id: "clerk-block-leader",
      email: "leader@example.com",
      name: "Block Leader",
      role: "block_leader",
      assigned_village_id: @village_one.id
    )

    @supporter_assigned = Supporter.create!(
      first_name: "Assigned", last_name: "Supporter", print_name: "Assigned Supporter",
      contact_number: "6715551111",
      village: @village_one,
      precinct: @precinct_one,
      source: "staff_entry",
      status: "active"
    )
    @supporter_unassigned = Supporter.create!(
      first_name: "Unassigned", last_name: "Supporter", print_name: "Unassigned Supporter",
      contact_number: "6715552222",
      village: @village_two,
      precinct: @precinct_two,
      source: "staff_entry",
      status: "active"
    )
  end

  test "poll watcher index only returns assigned village precincts" do
    get "/api/v1/poll_watcher", headers: auth_headers(@watcher)

    assert_response :success
    payload = JSON.parse(response.body)
    villages = payload["villages"]
    assert_equal 1, villages.length
    assert_equal @village_one.id, villages.first["id"]
  end

  test "poll watcher cannot submit report for unassigned precinct" do
    post "/api/v1/poll_watcher/report",
      params: {
        report: {
          precinct_id: @precinct_two.id,
          voter_count: 20,
          report_type: "turnout_update"
        }
      },
      headers: auth_headers(@watcher)

    assert_response :forbidden
    payload = JSON.parse(response.body)
    assert_equal "precinct_not_authorized", payload["code"]
  end

  test "poll watcher can submit report for assigned precinct" do
    post "/api/v1/poll_watcher/report",
      params: {
        report: {
          precinct_id: @precinct_one.id,
          voter_count: 25,
          report_type: "turnout_update"
        }
      },
      headers: auth_headers(@watcher)

    assert_response :created
    payload = JSON.parse(response.body)
    assert_equal @precinct_one.number, payload.dig("report", "precinct_number")
  end

  test "block leader cannot access poll watcher strike list endpoint" do
    get "/api/v1/poll_watcher/strike_list",
      params: { precinct_id: @precinct_one.id },
      headers: auth_headers(@block_leader)

    assert_response :forbidden
    payload = JSON.parse(response.body)
    assert_equal "poll_watcher_access_required", payload["code"]
  end

  test "village chief can view strike list for assigned village precinct" do
    get "/api/v1/poll_watcher/strike_list",
      params: { precinct_id: @precinct_one.id },
      headers: auth_headers(@chief)

    assert_response :success
    payload = JSON.parse(response.body)
    assert_equal @precinct_one.id, payload.dig("precinct", "id")
    assert_equal @supporter_assigned.id, payload["supporters"].first["id"]
  end

  test "district coordinator cannot view strike list outside assigned district" do
    get "/api/v1/poll_watcher/strike_list",
      params: { precinct_id: @precinct_two.id },
      headers: auth_headers(@coordinator)

    assert_response :forbidden
    payload = JSON.parse(response.body)
    assert_equal "precinct_not_authorized", payload["code"]
  end

  test "poll watcher can view strike list for assigned precinct" do
    get "/api/v1/poll_watcher/strike_list",
      params: { precinct_id: @precinct_one.id },
      headers: auth_headers(@watcher)

    assert_response :success
    payload = JSON.parse(response.body)
    assert_match(/Campaign operations tracking only/i, payload["compliance_note"])
    assert_equal @precinct_one.id, payload.dig("precinct", "id")
    assert_equal 1, payload["supporters"].length
    assert_equal @supporter_assigned.id, payload["supporters"].first["id"]
  end

  test "poll watcher cannot view strike list for unassigned precinct" do
    get "/api/v1/poll_watcher/strike_list",
      params: { precinct_id: @precinct_two.id },
      headers: auth_headers(@watcher)

    assert_response :forbidden
    payload = JSON.parse(response.body)
    assert_equal "precinct_not_authorized", payload["code"]
  end

  test "poll watcher can update turnout for assigned supporter" do
    patch "/api/v1/poll_watcher/strike_list/#{@supporter_assigned.id}/turnout",
      params: {
        turnout: {
          precinct_id: @precinct_one.id,
          turnout_status: "voted",
          note: "Confirmed at polling site"
        }
      },
      headers: auth_headers(@watcher)

    assert_response :success
    payload = JSON.parse(response.body)
    assert_match(/Campaign operations tracking only/i, payload["compliance_note"])
    assert_equal "voted", payload.dig("supporter", "turnout_status")
    assert_equal "poll_watcher", payload.dig("supporter", "turnout_source")

    audit_log = AuditLog.where(auditable: @supporter_assigned, action: "turnout_updated").order(created_at: :desc).first
    assert audit_log.present?
    assert_equal @watcher.id, audit_log.actor_user_id
    assert_equal "campaign_operations_not_official_record", audit_log.metadata["compliance_context"]
    assert_equal "unknown", audit_log.changed_data.dig("turnout_status", "from")
    assert_equal "voted", audit_log.changed_data.dig("turnout_status", "to")
  end

  test "poll watcher cannot update turnout for supporter outside assigned precinct" do
    patch "/api/v1/poll_watcher/strike_list/#{@supporter_unassigned.id}/turnout",
      params: {
        turnout: {
          precinct_id: @precinct_two.id,
          turnout_status: "voted"
        }
      },
      headers: auth_headers(@watcher)

    assert_response :forbidden
    payload = JSON.parse(response.body)
    assert_equal "precinct_not_authorized", payload["code"]
  end

  test "poll watcher can log contact attempt for assigned supporter" do
    post "/api/v1/poll_watcher/strike_list/#{@supporter_assigned.id}/contact_attempts",
      params: {
        contact_attempt: {
          precinct_id: @precinct_one.id,
          outcome: "attempted",
          channel: "call",
          note: "No answer"
        }
      },
      headers: auth_headers(@watcher)

    assert_response :created
    payload = JSON.parse(response.body)
    assert_match(/Campaign operations tracking only/i, payload["compliance_note"])
    assert_equal @supporter_assigned.id, payload.dig("contact_attempt", "supporter_id")
    assert_equal "attempted", payload.dig("contact_attempt", "outcome")

    attempt = SupporterContactAttempt.find(payload.dig("contact_attempt", "id"))
    audit_log = AuditLog.where(auditable: attempt, action: "created").order(created_at: :desc).first
    assert audit_log.present?
    assert_equal @watcher.id, audit_log.actor_user_id
    assert_equal "campaign_operations_not_official_record", audit_log.metadata["compliance_context"]
    assert_equal "attempted", audit_log.changed_data.dig("outcome", "to")
  end
end
