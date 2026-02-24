class CreateSprintGoals < ActiveRecord::Migration[8.0]
  def change
    create_table :sprint_goals do |t|
      t.references :campaign, null: false, foreign_key: true
      t.references :village, null: true, foreign_key: true
      t.string :title, null: false
      t.integer :target_count, null: false
      t.integer :current_count, default: 0
      t.date :start_date, null: false
      t.date :end_date, null: false
      t.string :period_type, default: "custom"
      t.string :status, default: "active"
      t.timestamps
    end
    add_index :sprint_goals, [ :campaign_id, :status ]
  end
end
