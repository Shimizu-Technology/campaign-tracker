require "test_helper"

class Api::V1::PollWatcherControllerTest < ActionDispatch::IntegrationTest
  def setup
    @village_one = Village.create!(name: "Village One")
    @village_two = Village.create!(name: "Village Two")

    @precinct_one = Precinct.create!(number: "1", village: @village_one, registered_voters: 100)
    @precinct_two = Precinct.create!(number: "2", village: @village_two, registered_voters: 100)

    @watcher = User.create!(
      clerk_id: "clerk-watcher",
      email: "watcher@example.com",
      name: "Watcher",
      role: "poll_watcher",
      assigned_village_id: @village_one.id
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
end
