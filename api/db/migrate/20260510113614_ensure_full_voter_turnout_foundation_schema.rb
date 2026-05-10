class EnsureFullVoterTurnoutFoundationSchema < ActiveRecord::Migration[8.1]
  def up
    ensure_supporter_gec_voter_reference
    ensure_gec_turnout_columns
  end

  def down
    # This migration repairs required production schema from the full voter
    # turnout foundation. Do not drop columns that may have been created by the
    # original foundation migration.
  end

  private

  def ensure_supporter_gec_voter_reference
    unless column_exists?(:supporters, :gec_voter_id)
      add_reference :supporters, :gec_voter, foreign_key: true
      return
    end

    add_index :supporters, :gec_voter_id unless index_exists?(:supporters, :gec_voter_id)
    unless foreign_key_exists?(:supporters, :gec_voters, column: :gec_voter_id)
      add_foreign_key :supporters, :gec_voters, column: :gec_voter_id
    end
  end

  def ensure_gec_turnout_columns
    unless column_exists?(:gec_voters, :turnout_status)
      add_column :gec_voters, :turnout_status, :string, null: false, default: "not_yet_voted"
    end

    add_column :gec_voters, :turnout_source, :string unless column_exists?(:gec_voters, :turnout_source)
    add_column :gec_voters, :turnout_note, :text unless column_exists?(:gec_voters, :turnout_note)
    add_column :gec_voters, :turnout_updated_at, :datetime unless column_exists?(:gec_voters, :turnout_updated_at)
    unless column_exists?(:gec_voters, :turnout_updated_by_user_id)
      add_column :gec_voters, :turnout_updated_by_user_id, :bigint
    end

    add_index :gec_voters, :turnout_status unless index_exists?(:gec_voters, :turnout_status)
    unless foreign_key_exists?(:gec_voters, :users, column: :turnout_updated_by_user_id)
      add_foreign_key :gec_voters, :users, column: :turnout_updated_by_user_id
    end
  end
end
