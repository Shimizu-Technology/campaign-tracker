# frozen_string_literal: true

# Parses and imports GEC voter registration lists (Excel format).
# Handles DOB month/day swap detection and village resolution.
class GecImportService
  REQUIRED_COLUMNS = %w[first_name last_name].freeze
  OPTIONAL_COLUMNS = %w[dob birth_year village voter_registration_number].freeze

  # Column name aliases to handle different GEC Excel formats
  COLUMN_ALIASES = {
    "first_name" => [ "first_name", "first name", "fname", "given_name", "given name" ],
    "last_name" => [ "last_name", "last name", "lname", "surname", "family_name", "family name" ],
    "dob" => [ "dob", "date_of_birth", "date of birth", "birth_date", "birth date", "birthday" ],
    # GEC now provides year of birth only (no full DOB) — support both formats
    "birth_year" => [ "birth_year", "year_of_birth", "year of birth", "yob", "birth year", "birthyear" ],
    "village" => [ "village", "municipality", "district", "precinct_village", "voting_district" ],
    "voter_registration_number" => [ "voter_registration_number", "voter_reg", "registration_number", "reg_no", "reg_number", "vrn" ]
  }.freeze

  Result = Struct.new(:success, :gec_import, :errors, :stats, keyword_init: true)

  def initialize(file_path:, gec_list_date:, uploaded_by_user: nil, sheet_name: nil, import_type: "full_list")
    @file_path = file_path
    @gec_list_date = gec_list_date
    @uploaded_by_user = uploaded_by_user
    @sheet_name = sheet_name
    @import_type = import_type
    @errors = []
    @stats = { total: 0, new: 0, updated: 0, ambiguous_dob: 0, skipped: 0, removed: 0, transferred: 0, re_vetted: 0 }
    @seen_voter_ids = Set.new
  end

  def call
    gec_import = GecImport.create!(
      gec_list_date: @gec_list_date,
      filename: File.basename(@file_path),
      uploaded_by_user: @uploaded_by_user,
      import_type: @import_type,
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

        # For full list imports, detect purged voters (in DB but not in file)
        if @import_type == "full_list" && @seen_voter_ids.any?
          detect_purged_voters(gec_import)
        end
      end

      # Re-vet affected supporters (outside transaction for performance)
      @stats[:re_vetted] = re_vet_affected_supporters(gec_import)

      gec_import.update!(
        status: "completed",
        total_records: @stats[:total],
        new_records: @stats[:new],
        updated_records: @stats[:updated],
        removed_records: @stats[:removed],
        transferred_records: @stats[:transferred],
        ambiguous_dob_count: @stats[:ambiguous_dob],
        re_vetted_count: @stats[:re_vetted],
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

    dob = nil
    dob_ambiguous = false
    birth_year = nil

    if column_map["dob"]
      dob, dob_ambiguous = parse_dob(row[column_map["dob"]])
      birth_year = dob&.year
    end

    # Explicit birth_year column (new GEC format — year only)
    if column_map["birth_year"]
      parsed_year = parse_birth_year(row[column_map["birth_year"]])
      birth_year = parsed_year if parsed_year.present?
      # If we only have year, no full dob
      dob = nil if column_map["dob"].blank?
    end

    {
      first_name: first_name,
      last_name: last_name,
      dob: dob,
      dob_ambiguous: dob_ambiguous,
      birth_year: birth_year,
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

    # Find existing record: try name+village+(DOB or birth_year) first, then name+(DOB or birth_year) for transfers
    fn_lower = data[:first_name].downcase
    ln_lower = data[:last_name].downcase
    vn_lower = data[:village_name].downcase

    record = nil

    # First: exact match on name + village (+ DOB or birth_year if available)
    scope = GecVoter.where("LOWER(first_name) = ? AND LOWER(last_name) = ? AND LOWER(village_name) = ?", fn_lower, ln_lower, vn_lower)
    if data[:dob].present?
      scope = scope.where(dob: data[:dob])
    elsif data[:birth_year].present?
      scope = scope.where(birth_year: data[:birth_year])
    end
    record = scope.first

    # Second: name + (DOB or birth_year) only (detects village transfer)
    if record.nil?
      if data[:dob].present?
        record = GecVoter.where("LOWER(first_name) = ? AND LOWER(last_name) = ?", fn_lower, ln_lower)
          .where(dob: data[:dob]).first
      elsif data[:birth_year].present?
        record = GecVoter.where("LOWER(first_name) = ? AND LOWER(last_name) = ?", fn_lower, ln_lower)
          .where(birth_year: data[:birth_year]).first
      end
    end

    if record
      # Detect village transfer
      old_village = record.village_name&.downcase&.strip
      new_village = data[:village_name]&.downcase&.strip
      village_changed = old_village.present? && new_village.present? && old_village != new_village

      attrs = {
        gec_list_date: @gec_list_date,
        imported_at: Time.current,
        status: "active",
        removed_at: nil,
        removal_detected_by_import_id: nil,
        voter_registration_number: data[:voter_registration_number] || record.voter_registration_number,
        dob: data[:dob] || record.dob,
        dob_ambiguous: data[:dob_ambiguous],
        birth_year: data[:birth_year] || record.birth_year
      }

      if village_changed
        attrs[:previous_village_name] = record.village_name
        attrs[:village_name] = data[:village_name]
        attrs[:village_id] = nil # Will be re-resolved by before_validation
        @stats[:transferred] += 1
      end

      record.update!(**attrs)
      @seen_voter_ids.add(record.id)
      @stats[:updated] += 1
    else
      voter = GecVoter.create!(
        first_name: data[:first_name],
        last_name: data[:last_name],
        dob: data[:dob],
        dob_ambiguous: data[:dob_ambiguous],
        birth_year: data[:birth_year],
        village_name: data[:village_name],
        voter_registration_number: data[:voter_registration_number],
        gec_list_date: @gec_list_date,
        imported_at: Time.current,
        status: "active"
      )
      @seen_voter_ids.add(voter.id)
      @stats[:new] += 1
    end
  end

  # Mark voters as removed if they were active but not seen in this full-list import.
  def detect_purged_voters(gec_import)
    purged = GecVoter.active.where.not(id: @seen_voter_ids.to_a)
    count = purged.count

    purged.update_all(
      status: "removed",
      removed_at: Time.current,
      removal_detected_by_import_id: gec_import.id
    )

    @stats[:removed] = count
  end

  # Re-vet supporters whose GEC voter record changed (village transfer or re-appeared).
  # Also flags supporters matched to now-removed voters.
  def re_vet_affected_supporters(gec_import)
    count = 0

    # Supporters linked to transferred voters need re-vetting
    if @stats[:transferred] > 0
      transferred_voters = GecVoter.where.not(previous_village_name: nil)
        .where(gec_list_date: @gec_list_date)

      transferred_voters.find_each do |gv|
        # Find supporters in the OLD village with matching name
        old_village = Village.find_by("LOWER(name) = ?", gv.previous_village_name.downcase.strip)
        next unless old_village

        affected = Supporter.active.where(village_id: old_village.id)
          .where("LOWER(first_name) = ? AND LOWER(last_name) = ?",
            gv.first_name.downcase, gv.last_name.downcase)
          .where(verification_status: "verified")

        affected.find_each do |supporter|
          supporter.update_columns(
            verification_status: "flagged",
            updated_at: Time.current
          )
          count += 1
        end
      end
    end

    # Supporters matched to now-removed voters need flagging.
    # Match by name + village to avoid flagging unrelated supporters with same name elsewhere.
    if @stats[:removed] > 0
      removed_voters = GecVoter.removed
        .where(removal_detected_by_import_id: gec_import.id)

      removed_voters.find_each do |gv|
        # Find the village object from gv.village_name
        removed_village = Village.find_by("LOWER(name) = ?", gv.village_name.downcase.strip)
        next unless removed_village

        affected = Supporter.active
          .where(village_id: removed_village.id)
          .where(
            "LOWER(first_name) = ? AND LOWER(last_name) = ?",
            gv.first_name.downcase, gv.last_name.downcase
          ).where(verification_status: "verified")

        affected.find_each do |supporter|
          supporter.update_columns(
            verification_status: "flagged",
            registered_voter: false,
            updated_at: Time.current
          )
          count += 1
        end
      end
    end

    count
  end

  # Parse a year-only birth year value (new GEC format).
  # Accepts: integer (1985), string ("1985"), or a Date/DateTime (extracts year).
  def parse_birth_year(value)
    return nil if value.blank?

    case value
    when Integer
      value if value.between?(1900, Date.current.year)
    when Date, DateTime, Time
      value.year
    when String
      year = value.strip.to_i
      year if year.between?(1900, Date.current.year)
    when Float
      year = value.to_i
      year if year.between?(1900, Date.current.year)
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
