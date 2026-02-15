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
        # Strip non-digits, then normalize Guam country code (leading "1671" -> "671")
        execute <<-SQL
          UPDATE supporters
          SET normalized_phone = CASE
            WHEN REGEXP_REPLACE(contact_number, '[^0-9]', '', 'g') ~ '^1671' AND LENGTH(REGEXP_REPLACE(contact_number, '[^0-9]', '', 'g')) >= 11
            THEN SUBSTRING(REGEXP_REPLACE(contact_number, '[^0-9]', '', 'g') FROM 2)
            ELSE REGEXP_REPLACE(contact_number, '[^0-9]', '', 'g')
          END
          WHERE contact_number IS NOT NULL
        SQL
      end
    end
  end
end
