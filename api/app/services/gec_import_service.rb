# frozen_string_literal: true

# Parses and imports GEC voter registration lists (Excel format).
# Handles DOB month/day swap detection and village resolution.
class GecImportService
  REQUIRED_COLUMNS = %w[first_name last_name].freeze  # May be satisfied by combined_name
  OPTIONAL_COLUMNS = %w[dob birth_year village voter_registration_number dob_estimated].freeze
  MAX_STORED_ROW_ERRORS = 50

  # Column name aliases to handle different GEC Excel formats
  COLUMN_ALIASES = {
    "first_name" => [ "first_name", "first name", "fname", "given_name", "given name" ],
    "last_name" => [ "last_name", "last name", "lname", "surname", "family_name", "family name" ],
    # GEC official format: combined "NAME" column in "LAST, FIRST MIDDLE" format
    "combined_name" => [ "name" ],
    "dob" => [ "dob", "date_of_birth", "date of birth", "birth_date", "birth date", "birthday" ],
    # GEC now provides year of birth only (no full DOB) — support both formats
    "birth_year" => [ "birth_year", "year_of_birth", "year of birth", "yob", "birth year", "birthyear" ],
    "dob_estimated" => [ "dob_estimated", "dob estimated", "birth_year_only", "birth year only" ],
    "village" => [ "village", "municipality", "district", "precinct_village", "voting_district" ],
    "voter_registration_number" => [ "voter_registration_number", "voter_reg", "registration_number",
                                     "reg_no", "reg_number", "vrn", "reg._no.", "reg.no.", "reg._no" ]
  }.freeze

  # Maps GEC file village names (uppercase) to canonical DB names
  VILLAGE_NAME_MAP = {
    # Hagåtña variants
    "hagatna" => "Hagåtña", "hagtna" => "Hagåtña", "hagtana" => "Hagåtña", "agana" => "Hagåtña",
    # Hågat variants
    "agat" => "Hågat", "hagat" => "Hågat",
    # Inalåhan variants
    "inarajan" => "Inalåhan", "inalahan" => "Inalåhan", "inajaran" => "Inalåhan", "inarjan" => "Inalåhan",
    # Malesso' variants
    "merizo" => "Malesso'", "malesso'" => "Malesso'",
    # Talo'fo'fo' variants
    "talofofo" => "Talo'fo'fo'", "talo'fo'fo'" => "Talo'fo'fo'", "talo'fo'fo" => "Talo'fo'fo'", "talofo'fo" => "Talo'fo'fo'",
    # Humåtak variants
    "umatac" => "Humåtak",
    # Sånta Rita-Sumai variants
    "santa rita" => "Sånta Rita-Sumai", "santa rita-sumai" => "Sånta Rita-Sumai",
    # Chalan Pago/Ordot variants
    "chalan pago" => "Chalan Pago/Ordot", "ordot" => "Chalan Pago/Ordot",
    "chalan pago/ordot" => "Chalan Pago/Ordot", "ordot/ chalan pago" => "Chalan Pago/Ordot",
    # Agana Heights variants
    "agana hts" => "Agana Heights", "agana heights" => "Agana Heights",
    # Mongmong/Toto/Maite variants
    "mongmong" => "Mongmong/Toto/Maite", "toto" => "Mongmong/Toto/Maite", "maite" => "Mongmong/Toto/Maite",
    "mongmong/toto/mait" => "Mongmong/Toto/Maite",
    # Asan-Ma'ina variants
    "asan" => "Asan-Ma'ina", "maina" => "Asan-Ma'ina",
    # Direct matches (just lowercase versions)
    "dededo" => "Dededo", "tamuning" => "Tamuning", "yigo" => "Yigo",
    "barrigada" => "Barrigada", "yona" => "Yona", "sinajana" => "Sinajana",
    "mangilao" => "Mangilao", "piti" => "Piti",
    # Typos
    "barriagda" => "Barrigada", "barridaga" => "Barrigada",
    "sinjana" => "Sinajana", "tamunung" => "Tamuning",
    "deded" => "Dededo",
    "malojloj" => "Talo'fo'fo'",  # Malojloj is in Talo'fo'fo'
    # Tumon is part of Tamuning in GEC
    "tumon" => "Tamuning",
    # GMF (Guam Military Forces/base) - off-island or base residents → Unassigned village
    "gmf" => "Unassigned",
    "guam military forces" => "Unassigned",
    "military" => "Unassigned",
    "off-island" => "Unassigned",
    "off island" => "Unassigned",
    "overseas" => "Unassigned",
    "absentee" => "Unassigned"
  }.freeze

  # Village name used for voters with no village match (GMF, military, off-island)
  UNASSIGNED_VILLAGE_NAME = "Unassigned"
  PLACEHOLDER_VOTER_REGISTRATION_NUMBERS = %w[NEW].freeze

  # Cache TTL for heartbeat and progress keys. Must exceed the longest
  # plausible import runtime (60K rows on a loaded DB can take >1 hour).
  # Kept in the service to avoid a reverse dependency on GecImportJob.
  # GecImportJob::PROCESSING_TIMEOUT (30 min) should be less than this value.
  IMPORT_CACHE_TTL = 90.minutes


  Result = Struct.new(:success, :gec_import, :errors, :stats, keyword_init: true)

  def initialize(
    file_path:,
    gec_list_date:,
    uploaded_by_user: nil,
    sheet_name: nil,
    import_type: "full_list",
    gec_import: nil,
    parsing_progress_percent: 10,
    importing_progress_start: 20,
    importing_progress_end: 85,
    re_vetting_progress_percent: 90
  )
    @file_path = file_path
    @gec_list_date = gec_list_date
    @uploaded_by_user = uploaded_by_user
    @sheet_name = sheet_name
    @import_type = import_type
    @errors = []
    @stats = { total: 0, new: 0, updated: 0, matched_unchanged: 0, ambiguous_dob: 0, skipped: 0, removed: 0, transferred: 0, re_vetted: 0, unassigned: 0 }
    @seen_voter_ids = Set.new
    @import_started_at = nil
    @gec_import = gec_import
    @row_error_details = []
    @change_rows_buffer = []
    @vrn_lookup = {}
    @parsing_progress_percent = parsing_progress_percent
    @importing_progress_start = importing_progress_start
    @importing_progress_end = importing_progress_end
    @re_vetting_progress_percent = re_vetting_progress_percent
  end

  def call
    async_mode = @gec_import.present?
    gec_import = @gec_import || GecImport.create!(
      gec_list_date: @gec_list_date,
      filename: File.basename(@file_path),
      uploaded_by_user: @uploaded_by_user,
      import_type: @import_type,
      status: "processing"
    )
    @current_gec_import = gec_import

    begin
      update_progress!(gec_import, stage: "parsing", percent: @parsing_progress_percent) if async_mode
      spreadsheet = Roo::Spreadsheet.open(@file_path)
      sheet = @sheet_name ? spreadsheet.sheet(@sheet_name) : spreadsheet.sheet(0)

      headers = normalize_headers(sheet.row(1))
      column_map = build_column_map(headers)

      has_split_names = column_map["first_name"] && column_map["last_name"]
      has_combined_name = column_map["combined_name"]
      unless has_split_names || has_combined_name
        raise "Missing required columns: need first_name+last_name OR name (combined). Found headers: #{headers.join(', ')}"
      end

      rows = (2..sheet.last_row).map { |i| sheet.row(i) }
      @stats[:total] = rows.size
      @import_started_at = Time.current
      @vrn_lookup = build_voter_registration_lookup(rows, column_map)

      ActiveRecord::Base.transaction do
        rows.each_with_index do |row, idx|
          process_row(row, column_map, idx + 2) # +2 for 1-indexed header row

          if (idx % 500).zero?
            # NOTE: write_progress_cache is intentionally non-transactional.
            # Cache writes commit immediately regardless of the surrounding
            # DB transaction. If the transaction rolls back, the cached values
            # become stale. This is acceptable because the import status moves
            # to "failed" on rollback, and the controller only reads cached
            # progress for pending/processing imports.
            progress_span = [ @importing_progress_end - @importing_progress_start, 1 ].max
            progress = @importing_progress_start + ((idx.to_f / [ rows.size, 1 ].max) * progress_span).to_i
            write_progress_cache(gec_import.id, stage: "importing", percent: [ progress, @importing_progress_end ].min) if async_mode
          end
        end

        # For full list imports, detect purged voters (in DB but not in file)
        if @import_type == "full_list" && @seen_voter_ids.any?
          detect_purged_voters(gec_import)
        end

        flush_change_rows!
      end

      # Re-vet affected supporters (outside transaction for performance)
      update_progress!(gec_import, stage: "re_vetting", percent: @re_vetting_progress_percent) if async_mode
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
        metadata: (gec_import.metadata || {}).merge({
          "stage" => "completed",
          "progress_percent" => 100,
          "matched_unchanged" => @stats[:matched_unchanged],
          "skipped" => @stats[:skipped],
          "unassigned" => @stats[:unassigned],
          "errors" => @errors.first(MAX_STORED_ROW_ERRORS),
          "row_error_details" => @row_error_details
        })
      )

      Result.new(success: true, gec_import: gec_import, errors: @errors, stats: @stats)
    rescue => e
      gec_import.update!(
        status: "failed",
        metadata: (gec_import.metadata || {}).merge({ "stage" => "failed", "progress_percent" => 100, "error" => e.message })
      )
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

  # Preview a specific page of parsed rows without importing.
  def preview_page(page: 1, per_page: 100)
    spreadsheet = Roo::Spreadsheet.open(@file_path)
    sheet = @sheet_name ? spreadsheet.sheet(@sheet_name) : spreadsheet.sheet(0)

    headers = normalize_headers(sheet.row(1))
    column_map = build_column_map(headers)
    sheets = spreadsheet.sheets
    row_count = [ (sheet.last_row || 1) - 1, 0 ].max
    normalized_page = [ page.to_i, 1 ].max
    normalized_per_page = [ [ per_page.to_i, 1 ].max, 250 ].min
    total_pages = row_count.zero? ? 1 : (row_count.to_f / normalized_per_page).ceil
    effective_page = [ normalized_page, total_pages ].min
    offset = (effective_page - 1) * normalized_per_page
    start_row = offset + 2
    end_row = [ start_row + normalized_per_page - 1, sheet.last_row || 1 ].min

    rows = if start_row <= end_row
      (start_row..end_row).map do |i|
        raw = sheet.row(i)
        parse_row(raw, column_map)
      end
    else
      []
    end

    {
      headers: headers,
      column_map: column_map,
      sheets: sheets,
      row_count: row_count,
      preview_rows: rows,
      pagination: {
        page: effective_page,
        per_page: normalized_per_page,
        total_pages: total_pages,
        total_rows: row_count
      }
    }
  end

  # Parse the entire file for viewer/search use-cases.
  def preview_all
    spreadsheet = Roo::Spreadsheet.open(@file_path)
    sheet = @sheet_name ? spreadsheet.sheet(@sheet_name) : spreadsheet.sheet(0)

    headers = normalize_headers(sheet.row(1))
    column_map = build_column_map(headers)
    sheets = spreadsheet.sheets
    row_count = [ (sheet.last_row || 1) - 1, 0 ].max
    rows = row_count.positive? ? (2..sheet.last_row).map { |i| parse_row(sheet.row(i), column_map) } : []

    {
      headers: headers,
      column_map: column_map,
      sheets: sheets,
      row_count: row_count,
      preview_rows: rows
    }
  end

  private

  def update_progress!(gec_import, stage:, percent:)
    write_progress_cache(gec_import.id, stage: stage, percent: percent)
    gec_import.update_columns(
      metadata: (gec_import.metadata || {}).merge({ "stage" => stage, "progress_percent" => percent, "updated_at" => Time.current.iso8601 }),
      updated_at: Time.current
    )
  end

  def write_progress_cache(import_id, stage:, percent:)
    now = Time.current.iso8601
    Rails.cache.write(
      "gec_import_progress:#{import_id}",
      { "stage" => stage, "progress_percent" => percent, "updated_at" => now },
      expires_in: IMPORT_CACHE_TTL
    )
    # Also refresh the heartbeat cache so stale-detector sees activity
    write_heartbeat_cache(import_id)
  rescue StandardError => e
    Rails.logger.warn("GEC progress cache write failed for import #{import_id}: #{e.class}: #{e.message}")
  end

  # Non-transactional heartbeat visible to the stale-processing detector
  # in GecImportJob. DB updated_at is invisible during an open transaction,
  # so the job checks this cache key first.
  #
  # TTL must exceed the longest plausible import. If the TTL expires before
  # the import finishes, the stale detector falls back to DB updated_at which
  # may be stale (set at "parsing" stage before the transaction opened).
  # See GecImportJob comments for queue retry window requirements.
  def write_heartbeat_cache(import_id)
    Rails.cache.write(
      "gec_import_heartbeat:#{import_id}",
      Time.current.iso8601,
      expires_in: IMPORT_CACHE_TTL
    )
  rescue StandardError => e
    Rails.logger.warn("GEC heartbeat cache write failed for import #{import_id}: #{e.class}: #{e.message}")
  end

  def normalize_village_name(value)
    raw = value.to_s.strip
    return nil if raw.blank?

    mapped = VILLAGE_NAME_MAP[raw.downcase]
    return mapped if mapped.present?

    Village.where("LOWER(name) = ?", raw.downcase).pick(:name) || raw
  end

  def detect_known_village_name(value)
    raw = value.to_s.strip
    return nil if raw.blank?

    mapped = VILLAGE_NAME_MAP[raw.downcase]
    return mapped if mapped.present?

    Village.where("LOWER(name) = ?", raw.downcase).pick(:name)
  end

  def canonical_village_key(value)
    raw = value.to_s.strip
    return nil if raw.blank?

    # Callers pass already-normalized or persisted village names, so avoid
    # re-running village normalization (which can fall through to DB lookups)
    # inside the hot import loop.
    raw.downcase
  end

  def normalize_voter_registration_number(value)
    raw = value.to_s.strip
    return nil if raw.blank?
    return nil if PLACEHOLDER_VOTER_REGISTRATION_NUMBERS.include?(raw.upcase)

    raw
  end

  def build_voter_registration_lookup(rows, column_map)
    vrn_column = column_map["voter_registration_number"]
    return {} unless vrn_column

    vrns = rows.filter_map { |row| normalize_voter_registration_number(row[vrn_column]) }.uniq
    return {} if vrns.empty?

    GecVoter.active.where(voter_registration_number: vrns).each_with_object(Hash.new { |hash, key| hash[key] = [] }) do |voter, lookup|
      lookup[voter.voter_registration_number] << voter
    end
  end

  def parse_booleanish(value)
    return false if value.nil?

    ActiveModel::Type::Boolean.new.cast(value)
  end

  def remember_row_error!(row_number:, message:, row:, data:)
    @errors << "Row #{row_number}: #{message}"
    return if @row_error_details.length >= MAX_STORED_ROW_ERRORS

    @row_error_details << {
      "row_number" => row_number,
      "message" => message,
      "source_name" => data[:source_name],
      "voter_registration_number" => data[:voter_registration_number],
      "first_name" => data[:first_name],
      "last_name" => data[:last_name],
      "village_name" => data[:village_name],
      "birth_year" => data[:birth_year],
      "raw_values" => Array(row).map { |value| value.to_s.strip }.reject(&:blank?).first(10)
    }
  end

  def log_change_row!(change_type:, current_values:, row_number: nil, details: {}, auto_flush: true)
    return unless @current_gec_import

    @change_rows_buffer << {
      gec_import_id: @current_gec_import.id,
      change_type: change_type,
      row_number: row_number,
      first_name: current_values[:first_name],
      last_name: current_values[:last_name],
      voter_registration_number: current_values[:voter_registration_number],
      village_name: current_values[:village_name],
      previous_village_name: current_values[:previous_village_name],
      birth_year: current_values[:birth_year],
      dob: current_values[:dob],
      details: details.compact,
      created_at: Time.current,
      updated_at: Time.current
    }

    flush_change_rows! if auto_flush && @change_rows_buffer.length >= 500
  end

  def flush_change_rows!
    return if @change_rows_buffer.empty?

    GecImportChange.insert_all!(@change_rows_buffer)
    @change_rows_buffer.clear
  end

  def build_changed_fields(before_values, after_values)
    changed = {}
    after_values.each do |field, after_value|
      before_value = before_values[field]
      next if before_value == after_value

      changed[field.to_s] = {
        before: before_value,
        after: after_value
      }
    end
    changed
  end

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
    first_name = nil
    last_name = nil

    if column_map["combined_name"]
      # GEC format: "NAME" column has "LAST, FIRST MIDDLE" format
      combined = row[column_map["combined_name"]]&.to_s&.strip
      if combined&.include?(",")
        last_part, first_part = combined.split(",", 2)
        last_name = last_part.strip
        first_name = first_part.strip.split(" ").first  # Take first word of given name
      elsif combined.present?
        parts = combined.split(" ")
        last_name = parts.last
        first_name = parts.first(parts.size - 1).join(" ")
      end
    else
      first_name = row[column_map["first_name"]]&.to_s&.strip
      last_name = row[column_map["last_name"]]&.to_s&.strip
    end

    # GEC file: village is in column after address (no header label)
    # Detect by checking column_map for combined_name pattern (GEC official format)
    village_name = nil
    if column_map["village"]
      village_name = normalize_village_name(row[column_map["village"]])
    elsif column_map["combined_name"] && column_map["dob"]
      # GEC format: village is typically at the column after address (index 4 for GEC Q1-GE6)
      # Try to detect by finding a known Guam village name in surrounding columns
      candidate_indices = (4..[ row.size - 1, 8 ].min).to_a + [ 3 ]
      candidate_indices.each do |ci|
        val = row[ci]&.to_s&.strip
        next unless val.present?
        normalized_village = detect_known_village_name(val)
        if normalized_village.present?
          village_name = normalized_village
          break
        end
      end
    end

    vrn = if column_map["voter_registration_number"]
      normalize_voter_registration_number(row[column_map["voter_registration_number"]])
    end

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
      if parsed_year.present?
        # If both dob and birth_year present but years conflict, trust birth_year
        # and clear dob to avoid dob.year != birth_year inconsistency
        if dob.present? && dob.year != parsed_year
          dob = nil
          dob_ambiguous = false
        end
        birth_year = parsed_year
      end
      # If no full dob column at all, ensure dob stays nil
      dob = nil if column_map["dob"].blank?
    end

    dob_estimated = parse_booleanish(row[column_map["dob_estimated"]]) if column_map["dob_estimated"]
    if dob_estimated && birth_year.present?
      dob = nil
      dob_ambiguous = false
    end

    {
      first_name: first_name,
      last_name: last_name,
      dob: dob,
      dob_estimated: dob_estimated,
      dob_ambiguous: dob_ambiguous,
      birth_year: birth_year,
      village_name: village_name,
      voter_registration_number: vrn,
      source_name: column_map["combined_name"] ? row[column_map["combined_name"]]&.to_s&.strip : nil
    }
  end

  def process_row(row, column_map, row_number)
    data = parse_row(row, column_map)

    if data[:first_name].blank? || data[:last_name].blank?
      remember_row_error!(
        row_number: row_number,
        message: "missing first_name or last_name",
        row: row,
        data: data
      )
      @stats[:skipped] += 1
      return
    end

    if data[:village_name].blank?
      # Route to "Unassigned" village instead of skipping
      # This captures GMF/military/off-island voters who have no standard village
      data[:village_name] = UNASSIGNED_VILLAGE_NAME
      @stats[:unassigned] += 1
    end

    @stats[:ambiguous_dob] += 1 if data[:dob_ambiguous]

    # Find existing record: try name+village+(DOB or birth_year) first, then name+(DOB or birth_year) for transfers
    fn_lower = data[:first_name].downcase
    ln_lower = data[:last_name].downcase
    vn_lower = canonical_village_key(data[:village_name]) || data[:village_name].downcase

    record = nil

    if data[:voter_registration_number].present?
      vrn_matches = @vrn_lookup[data[:voter_registration_number]] || []
      record = vrn_matches.first if vrn_matches.size == 1
    end

    # First: exact match on name + village (+ DOB or birth_year if available)
    if record.nil?
      scope = GecVoter.where("LOWER(first_name) = ? AND LOWER(last_name) = ? AND LOWER(village_name) = ?", fn_lower, ln_lower, vn_lower)
      if data[:dob].present? && !data[:dob_estimated]
        scope = scope.where(dob: data[:dob])
      elsif data[:birth_year].present?
        scope = scope.where(birth_year: data[:birth_year])
      end
      record = scope.first
    end

    # Second: name + (DOB or birth_year) only (detects village transfer)
    if record.nil?
      if data[:dob].present? && !data[:dob_estimated]
        record = GecVoter.where("LOWER(first_name) = ? AND LOWER(last_name) = ?", fn_lower, ln_lower)
          .where(dob: data[:dob]).first
      elsif data[:birth_year].present?
        candidates = GecVoter.where("LOWER(first_name) = ? AND LOWER(last_name) = ?", fn_lower, ln_lower)
          .where(birth_year: data[:birth_year])

        # Birth-year-only matching can have legitimate duplicates across villages.
        # Only auto-transfer when there's exactly one candidate.
        record = candidates.count == 1 ? candidates.first : nil
      end
    end

    if record
      # Detect village transfer
      old_village = canonical_village_key(record.village_name)
      new_village = canonical_village_key(data[:village_name])
      village_changed = old_village.present? && new_village.present? && old_village != new_village
      previous_values = {
        village_name: record.village_name,
        voter_registration_number: record.voter_registration_number,
        dob: record.dob,
        birth_year: record.birth_year
      }

      attrs = {
        gec_list_date: @gec_list_date,
        imported_at: @import_started_at,
        status: "active",
        removed_at: nil,
        removal_detected_by_import_id: nil,
        voter_registration_number: data[:voter_registration_number] || record.voter_registration_number,
        dob: data[:dob_estimated] ? record.dob : (data[:dob] || record.dob),
        dob_ambiguous: data[:dob_ambiguous].nil? ? record.dob_ambiguous : data[:dob_ambiguous],
        birth_year: data[:birth_year] || record.birth_year
      }

      if village_changed
        attrs[:previous_village_name] = record.village_name
        attrs[:village_name] = data[:village_name]
        attrs[:village_id] = nil # Will be re-resolved by before_validation
        @stats[:transferred] += 1
      end

      # Determine if any meaningful field actually changed.
      # NOTE: imported_at and gec_list_date are excluded by design — they are
      # bookkeeping timestamps that change on every import and would inflate
      # the :updated counter if included. They are still written via attrs
      # so the record reflects the latest import metadata.
      #
      # Also exclude dob_ambiguous-only flips from the public "updated" bucket.
      # Those are parser confidence changes, not voter-record changes.
      actually_changed = village_changed ||
        record.status != attrs[:status] ||
        record.voter_registration_number != attrs[:voter_registration_number] ||
        record.dob != attrs[:dob] ||
        record.birth_year != attrs[:birth_year]

      record.update!(**attrs)
      @seen_voter_ids.add(record.id)
      if actually_changed
        change_type = village_changed ? "transferred" : "updated"
        log_change_row!(
          change_type: change_type,
          row_number: row_number,
          current_values: {
            first_name: record.first_name,
            last_name: record.last_name,
            village_name: record.village_name,
            previous_village_name: previous_values[:village_name],
            voter_registration_number: record.voter_registration_number,
            birth_year: record.birth_year,
            dob: record.dob
          },
          details: {
            changed_fields: build_changed_fields(previous_values, {
              village_name: record.village_name,
              voter_registration_number: record.voter_registration_number,
              dob: record.dob,
              birth_year: record.birth_year
            }),
            source_name: data[:source_name]
          }
        )
        @stats[:updated] += 1 if change_type == "updated"
      else
        @stats[:matched_unchanged] += 1
      end
    else
      voter = GecVoter.create!(
        first_name: data[:first_name],
        last_name: data[:last_name],
        dob: data[:dob_estimated] ? nil : data[:dob],
        dob_ambiguous: data[:dob_ambiguous],
        birth_year: data[:birth_year],
        village_name: data[:village_name],
        voter_registration_number: data[:voter_registration_number],
        gec_list_date: @gec_list_date,
        imported_at: @import_started_at,
        status: "active"
      )
      @seen_voter_ids.add(voter.id)
      log_change_row!(
        change_type: "new",
        row_number: row_number,
        current_values: {
          first_name: voter.first_name,
          last_name: voter.last_name,
          village_name: voter.village_name,
          voter_registration_number: voter.voter_registration_number,
          birth_year: voter.birth_year,
          dob: voter.dob
        },
        details: {
          source_name: data[:source_name]
        }
      )
      @stats[:new] += 1
    end
  end

  # Mark voters as removed if they were active but not seen in this specific full-list import run.
  # Uses import_started_at (run marker), so same-date reruns are handled correctly.
  def detect_purged_voters(gec_import)
    purged = GecVoter.active.where("imported_at IS NULL OR imported_at < ?", @import_started_at)
    count = purged.count

    purged.find_each do |gv|
      log_change_row!(
        change_type: "removed",
        current_values: {
          first_name: gv.first_name,
          last_name: gv.last_name,
          village_name: gv.village_name,
          previous_village_name: gv.previous_village_name,
          voter_registration_number: gv.voter_registration_number,
          birth_year: gv.birth_year,
          dob: gv.dob
        },
        details: {
          reason: "missing_from_full_list"
        },
        auto_flush: false
      )
    end

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
      year = value.year
      year if year.between?(1900, Date.current.year)
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
    ambiguous = date.day <= 12 && date.month != date.day

    [ date, ambiguous ]
  end
end
