require "test_helper"

class Api::V1::ImportsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @village = Village.create!(name: "Import Audit Village")
    @user = User.create!(
      clerk_id: "clerk-import-audit-user",
      email: "import-audit@example.com",
      name: "Import Auditor",
      role: "campaign_admin"
    )
  end

  test "confirm writes per-supporter created audit logs" do
    first_one = "AnaImport#{SecureRandom.hex(2)}"
    first_two = "BenImport#{SecureRandom.hex(2)}"

    post "/api/v1/imports/confirm",
      params: {
        import_key: "a" * 32,
        village_id: @village.id,
        rows: [
          {
            "_row" => 1,
            "first_name" => first_one,
            "last_name" => "Cruz",
            "contact_number" => nil,
            "registered_voter" => true
          },
          {
            "_row" => 2,
            "first_name" => first_two,
            "last_name" => "Santos",
            "contact_number" => "671-555-1212",
            "registered_voter" => true
          }
        ]
      },
      headers: auth_headers(@user)

    assert_response :success
    payload = JSON.parse(response.body)
    assert_equal 2, payload["created"]

    supporters = Supporter.where(first_name: [ first_one, first_two ]).order(:first_name)
    assert_equal 2, supporters.count

    supporters.each do |supporter|
      created_log = AuditLog.where(auditable: supporter, action: "created").order(created_at: :desc).first
      assert_not_nil created_log
      assert_equal @user.id, created_log.actor_user_id
      assert_equal "bulk_import", created_log.metadata["entry_mode"]
      assert_equal supporter.id, created_log.auditable_id
      assert_equal "Supporter", created_log.auditable_type
      assert_equal supporter.first_name, created_log.changed_data.dig("first_name", "to")
    end
  end
end
