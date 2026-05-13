class EnsureGecElectionDayReadinessSchema < ActiveRecord::Migration[8.1]
  def up
    ensure_gec_import_election_day_columns
    ensure_poll_watcher_precinct_assignments
    ensure_full_voter_turnout_columns
  end

  def down
    # This migration repairs production schema drift from earlier election-day
    # readiness migrations. Do not remove columns/tables that may be in use.
  end

  private

  def ensure_gec_import_election_day_columns
    unless column_exists?(:gec_imports, :active_election_day)
      add_column :gec_imports, :active_election_day, :boolean, null: false, default: false
    end

    add_column :gec_imports, :activated_for_election_at, :datetime unless column_exists?(:gec_imports, :activated_for_election_at)
    unless column_exists?(:gec_imports, :activated_for_election_by_user_id)
      add_column :gec_imports, :activated_for_election_by_user_id, :bigint
    end

    change_column_default :gec_imports, :active_election_day, from: nil, to: false
    update("UPDATE gec_imports SET active_election_day = FALSE WHERE active_election_day IS NULL")
    change_column_null :gec_imports, :active_election_day, false

    unless index_exists?(:gec_imports, :active_election_day, name: "index_gec_imports_on_active_election_day")
      add_index :gec_imports,
        :active_election_day,
        unique: true,
        where: "active_election_day",
        name: "index_gec_imports_on_active_election_day"
    end

    unless foreign_key_exists?(:gec_imports, :users, column: :activated_for_election_by_user_id)
      add_foreign_key :gec_imports, :users, column: :activated_for_election_by_user_id
    end
  end

  def ensure_poll_watcher_precinct_assignments
    unless table_exists?(:poll_watcher_precinct_assignments)
      create_table :poll_watcher_precinct_assignments do |t|
        t.references :user, null: false, foreign_key: true
        t.references :precinct, null: false, foreign_key: true
        t.references :assigned_by_user, foreign_key: { to_table: :users }
        t.datetime :assigned_at, null: false
        t.timestamps

        t.index [ :user_id, :precinct_id ], unique: true, name: "index_poll_watcher_assignments_on_user_and_precinct"
      end
      return
    end

    ensure_reference :poll_watcher_precinct_assignments, :user, null: false, foreign_table: :users
    ensure_reference :poll_watcher_precinct_assignments, :precinct, null: false, foreign_table: :precincts
    ensure_reference :poll_watcher_precinct_assignments, :assigned_by_user, foreign_table: :users
    unless column_exists?(:poll_watcher_precinct_assignments, :assigned_at)
      add_column :poll_watcher_precinct_assignments, :assigned_at, :datetime
      update("UPDATE poll_watcher_precinct_assignments SET assigned_at = CURRENT_TIMESTAMP WHERE assigned_at IS NULL")
      change_column_null :poll_watcher_precinct_assignments, :assigned_at, false
    end

    unless index_exists?(:poll_watcher_precinct_assignments, [ :user_id, :precinct_id ], name: "index_poll_watcher_assignments_on_user_and_precinct")
      add_index :poll_watcher_precinct_assignments,
        [ :user_id, :precinct_id ],
        unique: true,
        name: "index_poll_watcher_assignments_on_user_and_precinct"
    end
  end

  def ensure_full_voter_turnout_columns
    unless column_exists?(:supporters, :gec_voter_id)
      add_reference :supporters, :gec_voter, foreign_key: true
    end

    add_index :supporters, :gec_voter_id unless index_exists?(:supporters, :gec_voter_id)
    unless foreign_key_exists?(:supporters, :gec_voters, column: :gec_voter_id)
      add_foreign_key :supporters, :gec_voters, column: :gec_voter_id
    end

    unless column_exists?(:gec_voters, :turnout_status)
      add_column :gec_voters, :turnout_status, :string, null: false, default: "not_yet_voted"
    end

    add_column :gec_voters, :turnout_source, :string unless column_exists?(:gec_voters, :turnout_source)
    add_column :gec_voters, :turnout_note, :text unless column_exists?(:gec_voters, :turnout_note)
    add_column :gec_voters, :turnout_updated_at, :datetime unless column_exists?(:gec_voters, :turnout_updated_at)
    unless column_exists?(:gec_voters, :turnout_updated_by_user_id)
      add_column :gec_voters, :turnout_updated_by_user_id, :bigint
    end

    change_column_default :gec_voters, :turnout_status, from: nil, to: "not_yet_voted"
    update("UPDATE gec_voters SET turnout_status = 'not_yet_voted' WHERE turnout_status IS NULL")
    change_column_null :gec_voters, :turnout_status, false

    add_index :gec_voters, :turnout_status unless index_exists?(:gec_voters, :turnout_status)
    unless foreign_key_exists?(:gec_voters, :users, column: :turnout_updated_by_user_id)
      add_foreign_key :gec_voters, :users, column: :turnout_updated_by_user_id
    end
  end

  def ensure_reference(table, reference, null: true, foreign_table:)
    column = :"#{reference}_id"
    unless column_exists?(table, column)
      add_reference table, reference, null: null, foreign_key: { to_table: foreign_table }
      return
    end

    add_index table, column unless index_exists?(table, column)
    add_foreign_key table, foreign_table, column: column unless foreign_key_exists?(table, foreign_table, column: column)
  end
end
