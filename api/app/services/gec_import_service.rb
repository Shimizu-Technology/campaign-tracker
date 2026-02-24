# frozen_string_literal: true

# Parses and imports GEC voter registration lists (Excel format).
# Handles DOB month/day swap detection and village resolution.
class GecImportService
  REQUIRED_COLUMNS = %w[first_name last_name].freeze
  OPTIONAL_COLUMNS = %w[dob village voter_registration_number].freeze

  # Column name aliases to handle different GEC Excel formats
  COLUMN_ALIASES = {
    "first_name" => [ "first_name", "first name", "fname", "given_name", "given name" ],
    "last_name" => [ "last_name", "last name", "lname", "surname", "family_name", "family name" ],
    "dob" => [ "dob", "date_of_birth", "date of birth", "birth_date", "birth date", "birthday" ],
    "village" => [ "village", "municipality", "district", "precinct_village", "voting_district" ],
    "voter_registration_number" => [ "voter_registration_number", "voter_reg", "registration_number", "reg_no", "reg_number", "vrn" ]
  }.freeze

  Result = Struct.new(:success, :gec_import, :errors, :stats, keyword_init: true)

  def initialize(file_path:, gec_list_date:, uploaded_by_user: nil, sheet_name: nil)
    @file_path = file_path
    @gec_list_date = gec_list_date
    @uploaded_by_user = uploaded_by_user
    @sheet_name = sheet_name
    @errors = []
    @stats = { total: 0, new: 0, updated: 0, ambiguous_dob: 0, skipped: 0 }
  end

  def call
    gec_import = GecImport.create!(
      gec_list_date: @gec_list_date,
      filename: File.basename(@file_path),
      uploaded_by_user: @uploaded_by_user,
      status: "processing"
    )

    begin
      spreadsheet = Roo::Spreadsheet.open(@file_path)
      sheet = @sheet_name ? spreadsheet.sheet(@sheet_name) : spreadsheet.sheet(0)

      headers = normalize_headers(sheet.row(1))
      column_map = build_column_map(headers)

      unless column_map["first_name"] && column_map["last_name"]
        raise "Missing required columns: first_name and last_name. Found headers: #{headers.join(', ')}"
      end

      rows = (2..sheet.last_row).map { |i| sheet.row(i) }
      @stats[:total] = rows.size

      ActiveRecord::Base.transaction do
        rows.each_with_index do |row, idx|
          process_row(row, column_map, idx + 2) # +2 for 1-indexed header row
        end
      end

      gec_import.update!(
        status: "completed",
        total_records: @stats[:total],
        new_records: @stats[:new],
        updated_records: @stats[:updated],
        ambiguous_dob_count: @stats[:ambiguous_dob],
        metadata: { skipped: @stats[:skipped], errors: @errors.first(50) }
      )

      Result.new(success: true, gec_import: gec_import, errors: @errors, stats: @stats)
    rescue => e
      gec_import.update!(status: "failed", metadata: { error: e.message })
      Result.new(success: false, gec_import: gec_import, errors: [ e.message ], stats: @stats)
    end
  end

  # Preview first N rows without importing
  def preview(limit: 20)
    spreadsheet = Roo::Spreadsheet.open(@file_path)
    sheet = @sheet_name ? spreadsheet.sheet(@sheet_name) : spreadsheet.sheet(0)

    headers = normalize_headers(sheet.row(1))
    column_map = build_column_map(headers)
    sheets = spreadsheet.sheets

    rows = (2..[ sheet.last_row, limit + 1 ].min).map do |i|
      raw = sheet.row(i)
      parse_row(raw, column_map)
    end

    {
      headers: headers,
      column_map: column_map,
      sheets: sheets,
      row_count: sheet.last_row - 1,
      preview_rows: rows
    }
  end

  private

  def normalize_headers(row)
    row.map { |h| h.to_s.strip.downcase.gsub(/\s+/, "_") }
  end

  def build_column_map(headers)
    map = {}
    COLUMN_ALIASES.each do |canonical, aliases|
      idx = headers.index { |h| aliases.include?(h) }
      map[canonical] = idx if idx
    end
    map
  end

  def parse_row(row, column_map)
    first_name = row[column_map["first_name"]]&.to_s&.strip
    last_name = row[column_map["last_name"]]&.to_s&.strip
    village_name = column_map["village"] ? row[column_map["village"]]&.to_s&.strip : nil
    vrn = column_map["voter_registration_number"] ? row[column_map["voter_registration_number"]]&.to_s&.strip : nil

    dob, dob_ambiguous = parse_dob(row[column_map["dob"]]) if column_map["dob"]

    {
      first_name: first_name,
      last_name: last_name,
      dob: dob,
      dob_ambiguous: dob_ambiguous || false,
      village_name: village_name,
      voter_registration_number: vrn
    }
  end

  def process_row(row, column_map, row_number)
    data = parse_row(row, column_map)

    if data[:first_name].blank? || data[:last_name].blank?
      @errors << "Row #{row_number}: missing first_name or last_name"
      @stats[:skipped] += 1
      return
    end

    if data[:village_name].blank?
      @errors << "Row #{row_number}: missing village for #{data[:first_name]} #{data[:last_name]}"
      @stats[:skipped] += 1
      return
    end

    @stats[:ambiguous_dob] += 1 if data[:dob_ambiguous]

    # Find existing record or create new one
    existing = GecVoter.where(
      "LOWER(first_name) = ? AND LOWER(last_name) = ? AND LOWER(village_name) = ?",
      data[:first_name].downcase,
      data[:last_name].downcase,
      data[:village_name].downcase
    )

    # If DOB available, narrow further
    existing = existing.where(dob: data[:dob]) if data[:dob].present?

    record = existing.first

    if record
      record.update!(
        gec_list_date: @gec_list_date,
        imported_at: Time.current,
        status: "active",
        voter_registration_number: data[:voter_registration_number] || record.voter_registration_number,
        dob: data[:dob] || record.dob,
        dob_ambiguous: data[:dob_ambiguous]
      )
      @stats[:updated] += 1
    else
      GecVoter.create!(
        first_name: data[:first_name],
        last_name: data[:last_name],
        dob: data[:dob],
        dob_ambiguous: data[:dob_ambiguous],
        village_name: data[:village_name],
        voter_registration_number: data[:voter_registration_number],
        gec_list_date: @gec_list_date,
        imported_at: Time.current,
        status: "active"
      )
      @stats[:new] += 1
    end
  end

  # Parse DOB with month/day swap detection.
  # When PDF→Excel conversion happens, month and day sometimes swap.
  # If both values are ≤ 12, we can't tell which is correct → flag as ambiguous.
  def parse_dob(value)
    return [ nil, false ] if value.blank?

    date = case value
    when Date, DateTime, Time
      value.to_date
    when String
      begin
        Date.parse(value)
      rescue Date::Error
        # Try common formats
        begin
          Date.strptime(value, "%m/%d/%Y")
        rescue Date::Error
          begin
            Date.strptime(value, "%d/%m/%Y")
          rescue Date::Error
            nil
          end
        end
      end
    when Numeric
      # Excel serial date number
      begin
        # Excel epoch is 1899-12-30
        (Date.new(1899, 12, 30) + value.to_i).to_date
      rescue
        nil
      end
    end

    return [ nil, false ] if date.nil?

    # DOB ambiguity check: if both month and day ≤ 12, we can't be sure
    # the PDF→Excel conversion didn't swap them
    ambiguous = date.month <= 12 && date.day <= 12 && date.month != date.day

    [ date, ambiguous ]
  end
end
