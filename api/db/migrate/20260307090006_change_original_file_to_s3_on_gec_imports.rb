class ChangeOriginalFileToS3OnGecImports < ActiveRecord::Migration[8.1]
  def change
    remove_column :gec_imports, :original_file_data, :binary
    add_column :gec_imports, :original_file_s3_key, :string
    add_column :gec_imports, :original_content_type, :string
  end
end
