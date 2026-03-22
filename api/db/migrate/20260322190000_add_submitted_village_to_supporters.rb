class AddSubmittedVillageToSupporters < ActiveRecord::Migration[8.1]
  def change
    add_reference :supporters, :submitted_village, foreign_key: { to_table: :villages }, null: true
  end
end
