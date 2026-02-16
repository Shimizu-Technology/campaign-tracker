class AddForeignKeyToSmsBlasts < ActiveRecord::Migration[8.0]
  def change
    add_foreign_key :sms_blasts, :users, column: :initiated_by_user_id
  end
end
