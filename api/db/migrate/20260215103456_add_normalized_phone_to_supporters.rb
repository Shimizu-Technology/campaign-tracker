class AddNormalizedPhoneToSupporters < ActiveRecord::Migration[8.1]
  def change
    add_column :supporters, :normalized_phone, :string

    # Index for exact match lookups during duplicate detection
    add_index :supporters, :normalized_phone, name: "index_supporters_on_normalized_phone"

    # Composite index for name+village duplicate matching
    add_index :supporters, [:village_id, :first_name, :last_name],
              name: "index_supporters_on_village_first_last_name"

    # Index for email duplicate matching
    add_index :supporters, :email, name: "index_supporters_on_email"

    # Backfill normalized phones
    reversible do |dir|
      dir.up do
        execute <<-SQL
          UPDATE supporters
          SET normalized_phone = REGEXP_REPLACE(contact_number, '[^0-9]', '', 'g')
          WHERE contact_number IS NOT NULL
        SQL
      end
    end
  end
end
