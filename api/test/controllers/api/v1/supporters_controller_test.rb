require "test_helper"

class Api::V1::SupportersControllerTest < ActionDispatch::IntegrationTest
  def setup
    @village = Village.create!(name: "Supporter Village")
    @user = User.create!(
      clerk_id: "clerk-supporters",
      email: "supporters@example.com",
      name: "Supporters User",
      role: "district_coordinator"
    )
    @readonly_user = User.create!(
      clerk_id: "clerk-readonly",
      email: "readonly@example.com",
      name: "Read Only User",
      role: "block_leader"
    )
    @poll_watcher = User.create!(
      clerk_id: "clerk-poll-watcher",
      email: "pollwatcher@example.com",
      name: "Poll Watcher User",
      role: "poll_watcher"
    )

    250.times do |idx|
      Supporter.create!(
        print_name: "Supporter #{idx}",
        contact_number: "671555#{format('%04d', idx)}",
        village: @village,
        source: "staff_entry",
        status: "active",
        registered_voter: false,
        yard_sign: false,
        motorcade_available: false
      )
    end
  end

  test "index requires authentication" do
    get "/api/v1/supporters"
    assert_response :unauthorized
    payload = JSON.parse(response.body)
    assert_equal "authorization_token_required", payload["code"]
  end

  test "poll watcher cannot view supporters index" do
    get "/api/v1/supporters", headers: auth_headers(@poll_watcher)

    assert_response :forbidden
    payload = JSON.parse(response.body)
    assert_equal "supporter_access_required", payload["code"]
  end

  test "index clamps per_page to max allowed" do
    get "/api/v1/supporters",
      params: { per_page: 10_000, page: 1 },
      headers: auth_headers(@user)

    assert_response :success
    payload = JSON.parse(response.body)
    assert_equal 200, payload.dig("pagination", "per_page")
    assert_equal 200, payload["supporters"].size
  end

  test "create auto-assigns precinct when village has one precinct" do
    single_village = Village.create!(name: "Single Precinct Village")
    single_precinct = Precinct.create!(number: "SP-1", village: single_village, registered_voters: 100)

    post "/api/v1/supporters",
      params: {
        supporter: {
          print_name: "Single Precinct Supporter",
          contact_number: "6715557000",
          village_id: single_village.id,
          precinct_id: nil,
          registered_voter: true
        }
      }

    assert_response :created
    payload = JSON.parse(response.body)
    assert_equal single_precinct.id, payload.dig("supporter", "precinct_id")
  end

  test "authenticated user can assign supporter precinct" do
    target_precinct = Precinct.create!(number: "SP-2", village: @village, registered_voters: 100)
    supporter = Supporter.create!(
      print_name: "Needs Assignment",
      contact_number: "6715557001",
      village: @village,
      precinct: nil,
      source: "staff_entry",
      status: "active"
    )

    patch "/api/v1/supporters/#{supporter.id}",
      params: { supporter: { precinct_id: target_precinct.id } },
      headers: auth_headers(@user)

    assert_response :success
    payload = JSON.parse(response.body)
    assert_equal target_precinct.id, payload.dig("supporter", "precinct_id")
  end

  test "public create sets source to qr_signup without auth header" do
    post "/api/v1/supporters",
      params: {
        supporter: {
          print_name: "Public Signup",
          contact_number: "6715558000",
          village_id: @village.id,
          registered_voter: true
        }
      }

    assert_response :created
    payload = JSON.parse(response.body)
    assert_equal "qr_signup", payload.dig("supporter", "source")
  end

  test "create with staff entry mode sets source to staff_entry and entered_by user" do
    staff_user = User.create!(
      clerk_id: "clerk-staff-entry",
      email: "staff-entry@example.com",
      name: "Staff Entry User",
      role: "block_leader"
    )

    post "/api/v1/supporters?entry_mode=staff",
      params: {
        supporter: {
          print_name: "Staff Signup",
          contact_number: "6715558001",
          village_id: @village.id,
          registered_voter: true
        }
      },
      headers: auth_headers(staff_user)

    assert_response :created
    payload = JSON.parse(response.body)
    assert_equal "staff_entry", payload.dig("supporter", "source")
    assert_equal staff_user.id, Supporter.find(payload.dig("supporter", "id")).entered_by_user_id
  end

  test "index can filter by precinct and unassigned precinct" do
    precinct = Precinct.create!(number: "SP-3", village: @village, registered_voters: 100)
    assigned = Supporter.create!(
      print_name: "Assigned Supporter",
      contact_number: "6715557002",
      village: @village,
      precinct: precinct,
      source: "staff_entry",
      status: "active"
    )
    unassigned = Supporter.create!(
      print_name: "Unassigned Supporter",
      contact_number: "6715557003",
      village: @village,
      precinct: nil,
      source: "staff_entry",
      status: "active"
    )

    get "/api/v1/supporters",
      params: { village_id: @village.id, precinct_id: precinct.id },
      headers: auth_headers(@user)
    assert_response :success
    payload = JSON.parse(response.body)
    ids = payload.fetch("supporters").map { |s| s.fetch("id") }
    assert_includes ids, assigned.id
    assert_not_includes ids, unassigned.id

    get "/api/v1/supporters",
      params: { village_id: @village.id, unassigned_precinct: "true" },
      headers: auth_headers(@user)
    assert_response :success
    payload = JSON.parse(response.body)
    ids = payload.fetch("supporters").map { |s| s.fetch("id") }
    assert_includes ids, unassigned.id
    assert_not_includes ids, assigned.id
  end

  test "index supports sorting by print_name ascending" do
    Supporter.create!(
      print_name: "Sort Test Zulu",
      contact_number: "6715559100",
      village: @village,
      source: "staff_entry",
      status: "active"
    )
    Supporter.create!(
      print_name: "Sort Test Alpha",
      contact_number: "6715559101",
      village: @village,
      source: "staff_entry",
      status: "active"
    )

    get "/api/v1/supporters",
      params: { search: "Sort Test", sort_by: "print_name", sort_dir: "asc" },
      headers: auth_headers(@user)

    assert_response :success
    payload = JSON.parse(response.body)
    names = payload.fetch("supporters").map { |s| s.fetch("print_name") }
    assert_equal "Sort Test Alpha", names.first
    assert_equal "Sort Test Zulu", names.last
  end

  test "show returns supporter details and audit logs" do
    supporter = Supporter.create!(
      print_name: "Show Supporter",
      contact_number: "6715559000",
      village: @village,
      source: "staff_entry",
      status: "active"
    )
    AuditLog.create!(
      auditable: supporter,
      actor_user: @user,
      action: "updated",
      changed_data: { "precinct_id" => { "from" => nil, "to" => 1 } },
      metadata: {}
    )

    get "/api/v1/supporters/#{supporter.id}", headers: auth_headers(@user)

    assert_response :success
    payload = JSON.parse(response.body)
    assert_equal supporter.id, payload.dig("supporter", "id")
    assert_equal 1, payload.fetch("audit_logs").length
    assert_equal true, payload.dig("permissions", "can_edit")
    assert_equal "district_coordinator", payload.dig("audit_logs", 0, "actor_role")
    assert_equal "Supporter updated", payload.dig("audit_logs", 0, "action_label")
  end

  test "update creates audit log entry" do
    precinct = Precinct.create!(number: "SP-4", village: @village, registered_voters: 100)
    supporter = Supporter.create!(
      print_name: "Audit Supporter",
      contact_number: "6715559001",
      village: @village,
      source: "staff_entry",
      status: "active"
    )

    assert_difference -> { AuditLog.count }, 1 do
      patch "/api/v1/supporters/#{supporter.id}",
        params: { supporter: { precinct_id: precinct.id } },
        headers: auth_headers(@user)
    end

    assert_response :success
    log = AuditLog.order(created_at: :desc).first
    assert_equal "updated", log.action
    assert_equal @user.id, log.actor_user_id
    assert_equal({ "from" => nil, "to" => precinct.id }, log.changed_data["precinct_id"])
  end

  test "update is forbidden for non editor roles" do
    precinct = Precinct.create!(number: "SP-5", village: @village, registered_voters: 100)
    supporter = Supporter.create!(
      print_name: "Read Only Supporter",
      contact_number: "6715559002",
      village: @village,
      source: "staff_entry",
      status: "active"
    )

    patch "/api/v1/supporters/#{supporter.id}",
      params: { supporter: { precinct_id: precinct.id } },
      headers: auth_headers(@readonly_user)

    assert_response :forbidden
    payload = JSON.parse(response.body)
    assert_equal "supporter_edit_access_required", payload["code"]
  end

  test "show returns edit permissions false for non editor roles" do
    supporter = Supporter.create!(
      print_name: "Show Read Only",
      contact_number: "6715559003",
      village: @village,
      source: "staff_entry",
      status: "active"
    )

    get "/api/v1/supporters/#{supporter.id}", headers: auth_headers(@readonly_user)

    assert_response :success
    payload = JSON.parse(response.body)
    assert_equal false, payload.dig("permissions", "can_edit")
  end
end
