# frozen_string_literal: true

require "csv"
require "tempfile"

# Parses Guam Election Commission PDF voter lists into normalized rows
# and provides a QA summary before import.
class GecPdfParserService
  Result = Struct.new(:rows, :qa, :warnings, :errors, keyword_init: true)

  VILLAGE_PATTERNS = [
    "AGANA HTS", "ASAN MAINA", "ASAN-MAINA", "CHALAN PAGO/ORDOT", "CHALAN PAGO", "ORDOT",
    "MONGMONG TOTO MAITE", "MONGMONG/TOTO/MAITE", "SANTA RITA-SUMAI", "SANTA RITA", "TALOFOFO",
    "HAGATNA", "HAGAT", "DEDEDO", "BARRIGADA", "MANGILAO", "SINAJANA", "TAMUNING", "YIGO",
    "YONA", "PITI", "HUMATAK", "MALESSO", "INALAHAN", "INARAJAN", "GMF", "TUMON"
  ].freeze

  HEADER_TEXT = /Guam Election Commission\s*Voter Listing\s*as of\s*.+?\s*REG\. NO\.\s*NAME\s*BIRTH YEAR\s*PCT\s*ADDRESS/i

  def initialize(file_path:)
    @file_path = file_path
    @warnings = []
    @errors = []
  end

  def parse
    reader = PDF::Reader.new(@file_path)
    rows = []
    seen = {}

    village_alt = Regexp.union(VILLAGE_PATTERNS.sort_by(&:length).reverse)
    # regno + NAME + address + village + zip + birthyear + pct
    row_regex = /(\d{4,7})([A-Z][A-Z'\.\-\s,]+?)\s+(.+?)\s+(#{village_alt})\s*969\d{2}\s*(19\d{2}|20\d{2})\s*(\d{1,2})(?=\d{4,7}[A-Z]|$)/

    reader.pages.each do |page|
      text = page.text.to_s
      next if text.blank?

      text = text.gsub("\n", " ")
      text = text.gsub(HEADER_TEXT, " ")
      text = text.gsub(/\s+/, " ").strip

      text.scan(row_regex) do |reg_no, name_raw, address_raw, village_raw, birth_year, pct|
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

    qa = build_qa(rows, reader.page_count)
    warn_if_low_quality(qa)

    Result.new(rows: rows, qa: qa, warnings: @warnings, errors: @errors)
  rescue StandardError => e
    @errors << e.message
    Result.new(rows: [], qa: {}, warnings: @warnings, errors: @errors)
  end

  def write_normalized_csv(rows)
    tf = Tempfile.new([ "gec_pdf_normalized", ".csv" ])
    CSV.open(tf.path, "wb") do |csv|
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

  def build_qa(rows, page_count)
    villages = rows.group_by { |r| r["village"] }.transform_values(&:count)
    missing_name = rows.count { |r| r["name"].blank? }
    missing_village = rows.count { |r| r["village"].blank? }
    missing_reg = rows.count { |r| r["voter_registration_number"].blank? }

    score = 100
    score -= 35 if rows.size < 10_000
    score -= 20 if missing_name.positive?
    score -= 20 if missing_village.positive?
    score -= 20 if missing_reg.positive?

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
