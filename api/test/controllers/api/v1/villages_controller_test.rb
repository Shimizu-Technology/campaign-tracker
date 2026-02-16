# frozen_string_literal: true

require "test_helper"

class Api::V1::VillagesControllerTest < ActionDispatch::IntegrationTest
  def setup
    @village = Village.create!(
      name: "Tamuning",
      region: "Central"
    )
    Precinct.create!(village: @village, number: "15A", alpha_range: "A-K", registered_voters: 600)
    Precinct.create!(village: @village, number: "15B", alpha_range: "L-Z", registered_voters: 500)
    @coordinator = User.create!(
      clerk_id: "clerk-coordinator-village",
      email: "coordinator-village@example.com",
      name: "Coordinator",
      role: "district_coordinator"
    )
  end

  test "index returns villages with computed registered_voters from precincts" do
    get "/api/v1/villages"

    assert_response :success
    villages = JSON.parse(response.body)["villages"]
    tamuning = villages.find { |v| v["name"] == "Tamuning" }
    assert_not_nil tamuning
    assert_equal 1100, tamuning["registered_voters"]
  end

  test "show returns village with precinct breakdown" do
    get "/api/v1/villages/#{@village.id}",
      headers: auth_headers(@coordinator)

    assert_response :success
    village = JSON.parse(response.body)["village"]
    assert_equal 1100, village["registered_voters"]
    assert_equal 2, village["precincts"].size
  end

  test "village update route does not exist" do
    patch "/api/v1/villages/#{@village.id}",
      params: { village: { name: "New Name" } },
      headers: auth_headers(@coordinator)

    assert_response :not_found
  end
end
