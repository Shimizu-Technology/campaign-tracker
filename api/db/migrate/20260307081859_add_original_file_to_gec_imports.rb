class AddOriginalFileToGecImports < ActiveRecord::Migration[8.1]
  def change
    add_column :gec_imports, :original_file_data, :binary
    add_column :gec_imports, :original_filename, :string
  end
end
