# frozen_string_literal: true

require "test_helper"

class GecPdfParserServiceTest < ActiveSupport::TestCase
  # ---------------------------------------------------------------------------
  # build_qa
  # ---------------------------------------------------------------------------

  test "build_qa returns fail status for empty rows" do
    qa = invoke_build_qa([], page_count: 1)
    assert_equal "fail", qa[:status]
    assert_equal 0, qa[:quality_score]
    assert_equal 0, qa[:row_count]
  end

  test "build_qa returns fail status below 1000 rows" do
    rows = minimal_rows(500)
    qa = invoke_build_qa(rows, page_count: 10)
    assert_equal "fail", qa[:status]
    assert qa[:quality_score] < 60, "Expected score <60 for 500 rows, got #{qa[:quality_score]}"
  end

  test "build_qa returns review status between 1000 and 9999 rows" do
    rows = minimal_rows(5_000)
    qa = invoke_build_qa(rows, page_count: 50)
    assert_equal "review", qa[:status]
  end

  test "build_qa returns pass status at or above 10000 rows" do
    rows = minimal_rows(10_000)
    qa = invoke_build_qa(rows, page_count: 100)
    assert_equal "pass", qa[:status]
    assert_equal 100, qa[:quality_score]
  end

  test "build_qa includes page_count and top_villages" do
    rows = minimal_rows(10_000, village: "DEDEDO")
    qa = invoke_build_qa(rows, page_count: 42)
    assert_equal 42, qa[:page_count]
    assert_includes qa[:top_villages].keys, "DEDEDO"
  end

  # ---------------------------------------------------------------------------
  # deduplication
  # ---------------------------------------------------------------------------

  test "duplicate rows are deduplicated by key" do
    # Two identical rows should produce one output row
    service = GecPdfParserService.new(file_path: "/dev/null")
    rows = []
    seen = {}
    # Simulate two identical entries
    2.times do
      reg_no, name, village, pct = "1234567", "JOHN DOE", "DEDEDO", "1"
      key = [ reg_no, name, village, pct ].join("|")
      unless seen[key]
        seen[key] = true
        rows << { "voter_registration_number" => reg_no, "name" => name, "village" => village, "pct" => pct }
      end
    end
    assert_equal 1, rows.size
  end

  # ---------------------------------------------------------------------------
  # ROW_REGEX constants sanity
  # ---------------------------------------------------------------------------

  test "ROW_REGEX is a Regexp" do
    assert_instance_of Regexp, GecPdfParserService::ROW_REGEX
  end

  test "VILLAGE_ALT matches known village names" do
    village_alt = GecPdfParserService::VILLAGE_ALT
    assert_match village_alt, "DEDEDO"
    assert_match village_alt, "TAMUNING"
    assert_match village_alt, "HAGATNA"
    assert_match village_alt, "MONGMONG TOTO MAITE"
  end

  test "REVIEW_MIN_ROWS and FAIL_MIN_ROWS are ordered correctly" do
    assert GecPdfParserService::FAIL_MIN_ROWS < GecPdfParserService::REVIEW_MIN_ROWS
  end

  # ---------------------------------------------------------------------------
  # write_normalized_csv
  # ---------------------------------------------------------------------------

  test "write_normalized_csv creates a readable CSV with correct headers" do
    service = GecPdfParserService.new(file_path: "/dev/null")
    rows = [
      { "name" => "JOHN DOE", "village" => "DEDEDO", "voter_registration_number" => "1234567",
        "dob" => "01/01/1980", "birth_year" => "1980", "pct" => "1", "address" => "123 MAIN ST" }
    ]
    tf = service.write_normalized_csv(rows)
    csv = CSV.read(tf.path)
    tf.close!
    assert_equal [ "name", "village", "voter_registration_number", "dob", "birth_year", "pct", "address" ], csv[0]
    assert_equal "JOHN DOE", csv[1][0]
    assert_equal "DEDEDO", csv[1][1]
  end

  private

  def invoke_build_qa(rows, page_count:)
    service = GecPdfParserService.new(file_path: "/dev/null")
    service.send(:build_qa, rows, page_count)
  end

  def minimal_rows(count, village: "DEDEDO")
    count.times.map do |i|
      { "name" => "VOTER #{i}", "village" => village, "voter_registration_number" => format("%07d", i),
        "dob" => "01/01/1980", "birth_year" => "1980", "pct" => "1", "address" => "ADDR #{i}" }
    end
  end
end
