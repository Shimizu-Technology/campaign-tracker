# frozen_string_literal: true

require "csv"
require "tempfile"
require "timeout"

# Parses Guam Election Commission PDF voter lists into normalized rows
# and provides a QA summary before import.
class GecPdfParserService
  Result = Struct.new(:rows, :qa, :warnings, :errors, keyword_init: true)

  HEADER_TEXT = /Guam Election Commission\s*Voter Listing\s*as of\s*.+?\s*REG\. NO\.\s*NAME\s*(?:ADDRESS\s*)?BIRTH YEAR\s*PCT/i
  PARSE_TIMEOUT_SECONDS = 10
  MAX_ADDRESS_CHARS = 150
  REVIEW_MIN_ROWS = 10_000 # Guam full-list imports are ~60k+ rows; below this is likely partial/test data
  FAIL_MIN_ROWS = 1_000

  # Sorted longest-first so Regexp.union matches greedily (e.g. "AGANA HEIGHTS" before "AGANA HTS")
  VILLAGE_ALT_STR = [
    "AGANA HEIGHTS", "AGANA HTS", "ASAN-MAINA", "ASAN MAINA",
    "CHALAN PAGO/ORDOT", "CHALAN PAGO", "ORDOT",
    "MONGMONG/TOTO/MAITE", "MONGMONG TOTO MAITE",
    "SANTA RITA-SUMAI", "SANTA RITA", "TALOFOFO",
    "HAGATNA", "HAGAT", "DEDEDO", "BARRIGADA", "MANGILAO", "SINAJANA",
    "TAMUNING", "YIGO", "YONA", "PITI", "HUMATAK", "MALESSO",
    "INALAHAN", "INARAJAN", "GMF", "TUMON"
  ].sort_by { |v| -v.length }.map { |v| Regexp.escape(v) }.join("|")

  # Current GEC export format (line-based): page_no reg_no name address village dob pct ...
  LINE_REGEX = Regexp.new(
    "^\\s*\\d+\\s+(\\d{4,7})\\s+" \
    "([A-Z][A-Z,\\.\\-\\'\\s]{2,80}?)\\s{2,}" \
    "([A-Z0-9 #,\\.\\-\\/]{3,#{MAX_ADDRESS_CHARS}}?)\\s{2,}" \
    "(#{VILLAGE_ALT_STR})\\s+" \
    "(\\d{1,2}\\/\\d{1,2}\\/\\d{2,4})\\s+" \
    "(\\d{1,2})\\b"
  )

  LEGACY_ADDRESS_PREFIXES = "ROUTE|MARINE|CHALAN|LOT|BLDG|BUILDING|UNIT|APT|APARTMENT|HOUSE".freeze

  # Legacy format fallback: REG_NO NAME ADDRESS VILLAGE 96XXX BIRTH_YEAR PCT
  ROW_REGEX = Regexp.new(
    "(\\d{4,7})\\s+" \
    "([A-Z][A-Z,\\.\\-\\'\\s]{2,80}?)(?=\\s+(?:PO BOX|\\d+\\s+[A-Z]|(?:#{LEGACY_ADDRESS_PREFIXES})\\b|#{VILLAGE_ALT_STR}))" \
    "([A-Z0-9 #,\\.\\-\\/]{3,#{MAX_ADDRESS_CHARS}}?)\\s+" \
    "(#{VILLAGE_ALT_STR})\\s+96\\d{3}\\s+" \
    "(19\\d{2}|20\\d{2})\\s+" \
    "(\\d{1,2})(?=\\s+\\d{4,7}|$)"
  )

  def initialize(file_path:)
    @file_path = file_path
    @warnings = []
    @errors = []
  end

  def parse
    reader = PDF::Reader.new(@file_path)
    rows = []
    seen = {}

    reader.pages.each do |page|
      begin
        Timeout.timeout(PARSE_TIMEOUT_SECONDS) do
          text = page.text.to_s
          next if text.blank?

          matched_rows = 0

          # 1) Primary parser: modern line-based export
          text.each_line do |line|
            compact = line.to_s.strip
            next if compact.blank?

            m = compact.match(LINE_REGEX)
            next unless m

            reg_no, name_raw, address_raw, village_raw, dob_raw, pct = m.captures
            birth_year = normalize_birth_year_from_dob(dob_raw)

            name = normalize_name(name_raw)
            next if name.blank? || name.start_with?("REG.")

            key = [ reg_no, name, village_raw, pct ].join("|")
            next if seen[key]

            seen[key] = true
            matched_rows += 1
            rows << {
              "name" => name,
              "village" => village_raw,
              "voter_registration_number" => reg_no,
              "dob" => dob_raw,
              "birth_year" => birth_year,
              "pct" => pct,
              "address" => normalize_text(address_raw)
            }
          end

          # 2) Fallback parser: legacy flattened format
          if matched_rows.zero?
            flat = text.gsub("\n", " ")
            flat = flat.gsub(HEADER_TEXT, " ")
            flat = flat.gsub(/\s+/, " ").strip
            next unless flat.match?(/\b96\d{3}\b/)

            flat.scan(ROW_REGEX) do |reg_no, name_raw, address_raw, village_raw, birth_year, pct|
              name = normalize_name(name_raw)
              next if name.blank? || name.start_with?("REG.")

              key = [ reg_no, name, village_raw, pct ].join("|")
              next if seen[key]

              seen[key] = true
              rows << {
                "name" => name,
                "village" => village_raw,
                "voter_registration_number" => reg_no,
                "dob" => birth_year_to_dob_placeholder(birth_year),
                "birth_year" => birth_year,
                "pct" => pct,
                "address" => normalize_text(address_raw)
              }
            end
          end
        end
      rescue Timeout::Error
        @errors << "PDF page parsing timed out (possible malformed layout)"
        break
      rescue StandardError => e
        @warnings << "Skipped page due to error: #{e.class}: #{e.message}"
        next
      end
    end

    qa = build_qa(rows, reader.page_count)
    warn_if_low_quality(qa)

    Result.new(rows: rows, qa: qa, warnings: @warnings, errors: @errors)
  rescue StandardError => e
    @errors << e.message
    Result.new(rows: [], qa: {}, warnings: @warnings, errors: @errors)
  end

  def write_normalized_csv(rows)
    tf = Tempfile.new([ "gec_pdf_normalized", ".csv" ])
    CSV.open(tf.path, "w", encoding: "UTF-8") do |csv|
      csv << [ "name", "village", "voter_registration_number", "dob", "birth_year", "pct", "address" ]
      rows.each { |r| csv << [ r["name"], r["village"], r["voter_registration_number"], r["dob"], r["birth_year"], r["pct"], r["address"] ] }
    end
    tf.close
    tf
  end

  private

  def normalize_name(value)
    v = normalize_text(value)
    v.gsub(/\s+/, " ")
  end

  def normalize_text(value)
    value.to_s.gsub(/\s+/, " ").strip
  end

  # Importer currently expects dob-like values. We use Jan 1 placeholder by birth year.
  def birth_year_to_dob_placeholder(year)
    return nil if year.blank?

    "01/01/#{year}"
  end

  def normalize_birth_year_from_dob(dob_raw)
    year = dob_raw.to_s.split("/").last.to_s.strip
    return year unless year.length == 2

    # Guam voter files can include younger voters with 2-digit years; use a moving cutoff.
    current_2_digit_year = Time.zone.now.year % 100
    year_i = year.to_i
    year_i <= current_2_digit_year ? "20#{year}" : "19#{year}"
  end

  def build_qa(rows, page_count)
    return {
      page_count: page_count,
      row_count: 0,
      quality_score: 0,
      missing_name: 0,
      missing_village: 0,
      missing_reg: 0,
      top_villages: {},
      status: "fail"
    } if rows.empty?

    villages = rows.group_by { |r| r["village"] }.transform_values(&:count)
    missing_name = rows.count { |r| r["name"].blank? }
    missing_village = rows.count { |r| r["village"].blank? }
    missing_reg = rows.count { |r| r["voter_registration_number"].blank? }

    score = 100
    score -= 35 if rows.size < REVIEW_MIN_ROWS
    score -= 65 if rows.size < FAIL_MIN_ROWS

    missing_ratio = (missing_name + missing_village + missing_reg).to_f / rows.size
    score -= 20 if missing_ratio > 0.05

    {
      page_count: page_count,
      row_count: rows.size,
      quality_score: score.clamp(0, 100),
      missing_name: missing_name,
      missing_village: missing_village,
      missing_reg: missing_reg,
      top_villages: villages.sort_by { |_k, v| -v }.first(10).to_h,
      status: score >= 80 ? "pass" : (score >= 60 ? "review" : "fail")
    }
  end

  def warn_if_low_quality(qa)
    if qa[:status] == "review"
      @warnings << "Parser quality is REVIEW. Manual sample verification required before import."
    elsif qa[:status] == "fail"
      @warnings << "Parser quality is FAIL. Do not import this PDF directly."
    end
  end
end
