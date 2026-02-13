require "test_helper"

class Api::V1::EventsControllerTest < ActionDispatch::IntegrationTest
  def setup
    @user = User.create!(
      clerk_id: "clerk-events",
      email: "events@example.com",
      name: "Events User",
      role: "block_leader"
    )

    @campaign = Campaign.create!(
      name: "Events Campaign",
      election_year: Date.current.year,
      status: "active"
    )

    @village = Village.create!(name: "Events Village")
  end

  test "motorcade event enqueues invite job" do
    assert_enqueued_with(job: MotorcadeInviteJob) do
      post "/api/v1/events",
        params: {
          event: {
            name: "Motorcade Test",
            event_type: "motorcade",
            date: Date.current.to_s,
            village_id: @village.id
          }
        },
        headers: auth_headers(@user)
    end

    assert_response :created
  end

  test "non-motorcade event does not enqueue invite job" do
    post "/api/v1/events",
      params: {
        event: {
          name: "Meeting Test",
          event_type: "meeting",
          date: Date.current.to_s,
          village_id: @village.id
        }
      },
      headers: auth_headers(@user)

    assert_response :created
    assert_enqueued_jobs 0
  end
end
