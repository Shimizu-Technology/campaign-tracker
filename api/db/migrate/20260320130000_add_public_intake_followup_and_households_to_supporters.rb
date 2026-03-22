class AddPublicIntakeFollowupAndHouseholdsToSupporters < ActiveRecord::Migration[8.1]
  def change
    create_table :household_groups do |t|
      t.references :village, null: true, foreign_key: true
      t.string :primary_contact_number
      t.string :primary_email
      t.string :street_address
      t.timestamps
    end

    change_table :supporters, bulk: true do |t|
      t.string :self_reported_registered_voter_status
      t.string :self_reported_voting_location
      t.boolean :wants_to_volunteer, null: false, default: false
      t.boolean :needs_absentee_ballot_help, null: false, default: false
      t.boolean :needs_homebound_voting_help, null: false, default: false
      t.boolean :needs_voter_registration_help, null: false, default: false
      t.boolean :needs_election_day_ride, null: false, default: false
      t.string :referred_by_name
      t.references :household_group, null: true, foreign_key: true
      t.bigint :registration_outreach_updated_by_user_id
    end

    add_index :supporters, :self_reported_registered_voter_status
    add_index :supporters, :needs_voter_registration_help
    add_index :supporters, :registration_outreach_updated_by_user_id
    add_foreign_key :supporters, :users, column: :registration_outreach_updated_by_user_id
  end
end
