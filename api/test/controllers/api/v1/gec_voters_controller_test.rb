require "test_helper"

class Api::V1::GecVotersControllerTest < ActionDispatch::IntegrationTest
  setup do
    @village = Village.find_or_create_by!(name: "Barrigada")
    @admin = User.create!(
      clerk_id: "clerk-gec-test-admin-#{SecureRandom.hex(4)}",
      email: "gec-admin-#{SecureRandom.hex(4)}@example.com",
      name: "GEC Admin",
      role: "campaign_admin"
    )

    # Create some GEC voters for testing
    @gec_voter = GecVoter.create!(
      first_name: "Juan",
      last_name: "Cruz",
      dob: Date.new(1985, 3, 15),
      village_name: "Barrigada",
      voter_registration_number: "VR12345",
      gec_list_date: Date.new(2026, 1, 25),
      imported_at: Time.current
    )

    GecVoter.create!(
      first_name: "Maria",
      last_name: "Santos",
      dob: Date.new(1990, 6, 20),
      village_name: "Barrigada",
      gec_list_date: Date.new(2026, 1, 25),
      imported_at: Time.current
    )

    GecVoter.create!(
      first_name: "Pedro",
      last_name: "Reyes",
      dob: Date.new(1975, 11, 8),
      village_name: "Dededo",
      gec_list_date: Date.new(2026, 1, 25),
      imported_at: Time.current
    )
  end

  test "index returns paginated GEC voters" do
    get "/api/v1/gec_voters", headers: auth_headers(@admin)

    assert_response :success
    json = JSON.parse(response.body)
    assert json["gec_voters"].is_a?(Array)
    assert json["pagination"]["total"] >= 3
  end

  test "index filters by village" do
    get "/api/v1/gec_voters", params: { village: "Barrigada" }, headers: auth_headers(@admin)

    assert_response :success
    json = JSON.parse(response.body)
    json["gec_voters"].each do |voter|
      assert_equal "Barrigada", voter["village_name"]
    end
  end

  test "index filters by last name prefix" do
    get "/api/v1/gec_voters", params: { last_name: "Cru" }, headers: auth_headers(@admin)

    assert_response :success
    json = JSON.parse(response.body)
    assert json["gec_voters"].any? { |v| v["last_name"] == "Cruz" }
  end

  test "stats returns overview" do
    get "/api/v1/gec_voters/stats", headers: auth_headers(@admin)

    assert_response :success
    json = JSON.parse(response.body)
    assert json["total_voters"] >= 3
    assert json["villages"].is_a?(Array)
  end

  test "match finds exact match by name + dob + village" do
    post "/api/v1/gec_voters/match",
      params: { first_name: "Juan", last_name: "Cruz", dob: "1985-03-15", village_name: "Barrigada" },
      headers: auth_headers(@admin)

    assert_response :success
    json = JSON.parse(response.body)
    assert json["matches"].any? { |m| m["confidence"] == "exact" }
  end

  test "match detects different village (potential referral)" do
    post "/api/v1/gec_voters/match",
      params: { first_name: "Juan", last_name: "Cruz", dob: "1985-03-15", village_name: "Dededo" },
      headers: auth_headers(@admin)

    assert_response :success
    json = JSON.parse(response.body)
    assert json["matches"].any? { |m| m["match_type"] == "different_village" }
  end

  test "match returns empty for unknown person" do
    post "/api/v1/gec_voters/match",
      params: { first_name: "Nonexistent", last_name: "Person", dob: "2000-01-01", village_name: "Barrigada" },
      headers: auth_headers(@admin)

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal 0, json["matches"].size
  end

  test "upload requires admin" do
    non_admin = User.create!(
      clerk_id: "clerk-gec-nonadmin-#{SecureRandom.hex(4)}",
      email: "gec-nonadmin-#{SecureRandom.hex(4)}@example.com",
      name: "Regular User",
      role: "block_leader"
    )

    post "/api/v1/gec_voters/upload",
      params: { file: fixture_file_upload("test/fixtures/files/empty.txt", "text/plain"), gec_list_date: "2026-02-25" },
      headers: auth_headers(non_admin)

    assert_response :forbidden
  end

  test "imports lists past imports" do
    GecImport.create!(
      gec_list_date: Date.new(2026, 1, 25),
      filename: "gec_jan_2026.xlsx",
      status: "completed",
      total_records: 50000
    )

    get "/api/v1/gec_voters/imports", headers: auth_headers(@admin)

    assert_response :success
    json = JSON.parse(response.body)
    assert json["imports"].any?
  end
end
