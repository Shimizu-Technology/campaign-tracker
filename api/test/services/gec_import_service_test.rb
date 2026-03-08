require "test_helper"
require "tempfile"
require "csv"

class GecImportServiceTest < ActiveSupport::TestCase
  setup do
    @village = Village.find_or_create_by!(name: "Barrigada")
    Village.find_or_create_by!(name: "Dededo")
  end

  test "parses Excel file and creates GEC voters" do
    file = create_test_excel([
      [ "First Name", "Last Name", "Date of Birth", "Village", "Reg No" ],
      [ "Juan", "Cruz", Date.new(1985, 3, 15), "Barrigada", "VR001" ],
      [ "Maria", "Santos", Date.new(1990, 6, 20), "Barrigada", "VR002" ],
      [ "Pedro", "Reyes", Date.new(1975, 11, 8), "Dededo", "VR003" ]
    ])

    service = GecImportService.new(
      file_path: file.path,
      gec_list_date: Date.new(2026, 2, 25)
    )

    result = service.call

    assert result.success, "Import should succeed. Errors: #{result.errors}"
    assert_equal 3, result.stats[:total]
    assert_equal 3, result.stats[:new]
    assert_equal 0, result.stats[:updated]

    assert_equal 3, GecVoter.count
    juan = GecVoter.find_by(first_name: "Juan", last_name: "Cruz")
    assert_equal Date.new(1985, 3, 15), juan.dob
    assert_equal "Barrigada", juan.village_name
    assert_equal @village.id, juan.village_id
  end

  test "updates existing voters on re-import" do
    GecVoter.create!(
      first_name: "Juan",
      last_name: "Cruz",
      dob: Date.new(1985, 3, 15),
      village_name: "Barrigada",
      gec_list_date: Date.new(2026, 1, 25),
      imported_at: 1.month.ago
    )

    file = create_test_excel([
      [ "First Name", "Last Name", "Date of Birth", "Village", "Reg No" ],
      [ "Juan", "Cruz", Date.new(1985, 3, 15), "Barrigada", "VR001-NEW" ]
    ])

    service = GecImportService.new(
      file_path: file.path,
      gec_list_date: Date.new(2026, 2, 25)
    )

    result = service.call

    assert result.success
    assert_equal 1, result.stats[:updated]
    assert_equal 0, result.stats[:new]
    assert_equal 1, GecVoter.count

    juan = GecVoter.first
    assert_equal Date.new(2026, 2, 25), juan.gec_list_date
    assert_equal "VR001-NEW", juan.voter_registration_number
  end

  test "detects ambiguous DOB" do
    # March 5 — both month (3) and day (5) are ≤ 12, could be May 3
    file = create_test_excel([
      [ "First Name", "Last Name", "Date of Birth", "Village" ],
      [ "Ana", "Flores", Date.new(1988, 3, 5), "Barrigada" ],
      [ "Ben", "Torres", Date.new(1992, 6, 25), "Barrigada" ]
    ])

    service = GecImportService.new(
      file_path: file.path,
      gec_list_date: Date.new(2026, 2, 25)
    )

    result = service.call

    assert result.success
    ana = GecVoter.find_by(first_name: "Ana")
    ben = GecVoter.find_by(first_name: "Ben")

    assert ana.dob_ambiguous, "Ana's DOB (March 5) should be flagged as ambiguous"
    refute ben.dob_ambiguous, "Ben's DOB (June 25) should NOT be ambiguous (day > 12)"
    assert_equal 1, result.stats[:ambiguous_dob]
  end

  test "skips rows with missing required fields" do
    file = create_test_excel([
      [ "First Name", "Last Name", "Village" ],
      [ "Juan", "Cruz", "Barrigada" ],
      [ "", "Santos", "Barrigada" ],
      [ "Pedro", "", "Barrigada" ]
    ])

    service = GecImportService.new(
      file_path: file.path,
      gec_list_date: Date.new(2026, 2, 25)
    )

    result = service.call

    assert result.success
    assert_equal 1, result.stats[:new]
    assert_equal 2, result.stats[:skipped]
    assert_equal 2, result.gec_import.metadata["row_error_details"].length
    assert_equal "missing first_name or last_name", result.gec_import.metadata["row_error_details"].first["message"]
  end

  test "pdf-style birth-year import matches existing voter by vrn and canonical village" do
    Village.find_or_create_by!(name: "Hagåtña")
    existing = GecVoter.create!(
      first_name: "ADRIAN",
      last_name: "ALDRIDGE",
      dob: Date.new(1947, 5, 10),
      birth_year: 1947,
      village_name: "Hagåtña",
      voter_registration_number: "24688",
      gec_list_date: Date.new(2025, 12, 25),
      imported_at: 1.month.ago,
      status: "active"
    )

    file = create_test_csv([
      [ "name", "village", "voter_registration_number", "dob", "dob_estimated", "birth_year", "pct", "address" ],
      [ "ALDRIDGE, ADRIAN", "HAGATNA", "24688", "01/01/1947", "true", "1947", "1", "133 OLIAZ ST" ]
    ])

    result = GecImportService.new(
      file_path: file.path,
      gec_list_date: Date.new(2026, 1, 25),
      import_type: "changes_only"
    ).call

    assert result.success
    assert_equal 0, result.stats[:new]
    assert_equal 0, result.stats[:updated]
    assert_equal 1, result.stats[:matched_unchanged]
    assert_equal 1, GecVoter.where(status: "active").count

    existing.reload
    assert_equal "Hagåtña", existing.village_name
    assert_equal Date.new(1947, 5, 10), existing.dob
    assert_equal 1947, existing.birth_year
  ensure
    file&.close!
  end

  test "official GEC combined-name format detects village column instead of address column" do
    Village.find_or_create_by!(name: "Dededo")

    file = create_test_excel([
      [ 16431, "REG. NO.", "NAME", "ADDRESS", nil, nil, "DOB", "PCT" ],
      [ 1, "43881", "ABAD, BRENDA R.", "PMB 932 111 CHALAN BALAKO", "DEDEDO", "GU", Date.new(1975, 11, 16), 18 ]
    ])

    service = GecImportService.new(
      file_path: file.path,
      gec_list_date: Date.new(2025, 12, 25)
    )
    preview = service.preview(limit: 5)

    assert_equal "Dededo", preview[:preview_rows][0][:village_name]
    refute_equal "PMB 932 111 CHALAN BALAKO", preview[:preview_rows][0][:village_name]
  ensure
    file&.close!
  end

  test "placeholder NEW registration numbers do not merge unrelated rows" do
    file = create_test_excel([
      [ 16431, "REG. NO.", "NAME", "ADDRESS", nil, nil, "DOB", "PCT", "CONTACT 1", "CONTACT 2", "EMAIL", "NOTES", "Q", "BL SOURCE", "MISC" ],
      [ 1, "NEW", "ADA, ADRIAN ANTHONY T.", nil, nil, nil, Date.new(1980, 3, 28), 9, "NEED CONTACT #", nil, nil, "EARLY VOTED AS OF 10/24/2022", "GE6", nil, nil ],
      [ 1, "NEW", "AFLLEJE, WILLIAM J.", nil, nil, nil, Date.new(1959, 12, 7), 14, "6717881550", nil, nil, "EARLY VOTED ON 10/12/2022", "GE5", nil, nil ]
    ])

    result = GecImportService.new(
      file_path: file.path,
      gec_list_date: Date.new(2025, 12, 25),
      import_type: "full_list"
    ).call

    assert result.success
    assert_equal 2, result.stats[:new]
    assert_equal 0, result.stats[:updated]
    assert_equal 2, GecVoter.count
    assert_equal 0, result.gec_import.change_records.where(change_type: "updated").count

    voters = GecVoter.order(:last_name, :first_name).pluck(:first_name, :last_name, :voter_registration_number, :village_name, :birth_year)
    assert_equal [
      [ "ADRIAN", "ADA", nil, "Unassigned", 1980 ],
      [ "WILLIAM", "AFLLEJE", nil, "Unassigned", 1959 ]
    ], voters
  ensure
    file&.close!
  end

  test "preview returns sample data without importing" do
    file = create_test_excel([
      [ "First Name", "Last Name", "Date of Birth", "Village" ],
      [ "Juan", "Cruz", Date.new(1985, 3, 15), "Barrigada" ],
      [ "Maria", "Santos", Date.new(1990, 6, 20), "Barrigada" ]
    ])

    service = GecImportService.new(
      file_path: file.path,
      gec_list_date: Date.new(2026, 2, 25)
    )

    preview = service.preview(limit: 10)

    assert_equal 2, preview[:row_count]
    assert_equal 2, preview[:preview_rows].size
    assert_equal "Juan", preview[:preview_rows][0][:first_name]
    assert_equal 0, GecVoter.count, "Preview should not create records"
  end

  test "parse_birth_year rejects out-of-range Date/DateTime/Time years" do
    service = GecImportService.new(file_path: "/tmp/fake.xlsx", gec_list_date: Date.new(2026, 2, 25))

    assert_nil service.send(:parse_birth_year, Date.new(2099, 1, 1))
    assert_nil service.send(:parse_birth_year, DateTime.new(1899, 1, 1, 0, 0, 0))
    assert_nil service.send(:parse_birth_year, Time.new(2099, 1, 1, 0, 0, 0))
    assert_equal 1985, service.send(:parse_birth_year, Date.new(1985, 7, 1))
  end

  test "creates GecImport record" do
    file = create_test_excel([
      [ "First Name", "Last Name", "Village" ],
      [ "Juan", "Cruz", "Barrigada" ]
    ])

    service = GecImportService.new(
      file_path: file.path,
      gec_list_date: Date.new(2026, 2, 25)
    )

    result = service.call

    assert result.success
    assert_equal 1, GecImport.count
    import = GecImport.first
    assert_equal "completed", import.status
    assert_equal 1, import.total_records
    assert_equal 1, import.new_records
  end

  test "full_list import detects purged voters" do
    # Existing voter from last month
    gv = GecVoter.create!(
      first_name: "Juan", last_name: "Cruz", village_name: "Barrigada",
      gec_list_date: Date.new(2026, 1, 25), imported_at: 1.month.ago, status: "active"
    )

    # New list does NOT include Juan — only Maria
    file = create_test_excel([
      [ "First Name", "Last Name", "Date of Birth", "Village", "Reg No" ],
      [ "Maria", "Santos", Date.new(1990, 6, 20), "Barrigada", "VR002" ]
    ])

    result = GecImportService.new(
      file_path: file.path,
      gec_list_date: Date.new(2026, 2, 25),
      import_type: "full_list"
    ).call

    assert result.success
    assert_equal 1, result.stats[:removed]
    assert_equal 1, result.stats[:new]

    gv.reload
    assert_equal "removed", gv.status
    assert_not_nil gv.removed_at
  end

  test "stores new and removed change records for a full list import" do
    GecVoter.create!(
      first_name: "Juan", last_name: "Cruz", village_name: "Barrigada",
      gec_list_date: Date.new(2026, 1, 25), imported_at: 1.month.ago, status: "active"
    )

    file = create_test_excel([
      [ "First Name", "Last Name", "Date of Birth", "Village", "Reg No" ],
      [ "Maria", "Santos", Date.new(1990, 6, 20), "Barrigada", "VR002" ]
    ])

    result = GecImportService.new(
      file_path: file.path,
      gec_list_date: Date.new(2026, 2, 25),
      import_type: "full_list"
    ).call

    assert result.success

    change_types = result.gec_import.change_records.order(:id).pluck(:change_type)
    assert_equal [ "new", "removed" ], change_types.sort

    removed_change = result.gec_import.change_records.find_by!(change_type: "removed")
    assert_equal "Juan", removed_change.first_name
    assert_equal "missing_from_full_list", removed_change.details["reason"]
  ensure
    file&.close!
  end

  test "changes_only import does not purge missing voters" do
    GecVoter.create!(
      first_name: "Juan", last_name: "Cruz", village_name: "Barrigada",
      gec_list_date: Date.new(2026, 1, 25), imported_at: 1.month.ago, status: "active"
    )

    file = create_test_excel([
      [ "First Name", "Last Name", "Date of Birth", "Village", "Reg No" ],
      [ "Maria", "Santos", Date.new(1990, 6, 20), "Barrigada", "VR002" ]
    ])

    result = GecImportService.new(
      file_path: file.path,
      gec_list_date: Date.new(2026, 2, 25),
      import_type: "changes_only"
    ).call

    assert result.success
    assert_equal 0, result.stats[:removed]
    # Juan should still be active
    assert_equal "active", GecVoter.find_by(first_name: "Juan").status
  end

  test "full_list import detects village transfers" do
    GecVoter.create!(
      first_name: "Juan", last_name: "Cruz", village_name: "Barrigada",
      dob: Date.new(1985, 3, 15), gec_list_date: Date.new(2026, 1, 25),
      imported_at: 1.month.ago, status: "active"
    )

    # Juan moved to Dededo
    file = create_test_excel([
      [ "First Name", "Last Name", "Date of Birth", "Village", "Reg No" ],
      [ "Juan", "Cruz", Date.new(1985, 3, 15), "Dededo", "VR001" ]
    ])

    result = GecImportService.new(
      file_path: file.path,
      gec_list_date: Date.new(2026, 2, 25),
      import_type: "full_list"
    ).call

    assert result.success
    assert_equal 1, result.stats[:transferred]
    assert_equal 0, result.stats[:updated]
    assert_equal 1, result.gec_import.reload.transferred_records
    assert_equal 0, result.gec_import.updated_records

    juan = GecVoter.find_by(first_name: "Juan")
    assert_equal "Dededo", juan.village_name
    assert_equal "Barrigada", juan.previous_village_name
    assert_equal "active", juan.status
  end

  test "stores transfer change details for moved voters" do
    GecVoter.create!(
      first_name: "Juan", last_name: "Cruz", village_name: "Barrigada",
      dob: Date.new(1985, 3, 15), gec_list_date: Date.new(2026, 1, 25),
      imported_at: 1.month.ago, status: "active"
    )

    file = create_test_excel([
      [ "First Name", "Last Name", "Date of Birth", "Village", "Reg No" ],
      [ "Juan", "Cruz", Date.new(1985, 3, 15), "Dededo", "VR001" ]
    ])

    result = GecImportService.new(
      file_path: file.path,
      gec_list_date: Date.new(2026, 2, 25),
      import_type: "full_list"
    ).call

    assert result.success

    transfer_change = result.gec_import.change_records.find_by!(change_type: "transferred")
    assert_equal "Dededo", transfer_change.village_name
    assert_equal "Barrigada", transfer_change.previous_village_name
    assert_equal "Barrigada", transfer_change.details["changed_fields"]["village_name"]["before"]
    assert_equal "Dededo", transfer_change.details["changed_fields"]["village_name"]["after"]
  ensure
    file&.close!
  end

  test "birth-year-only transfer fallback does not merge when multiple candidates exist" do
    GecVoter.create!(
      first_name: "Juan", last_name: "Cruz", birth_year: 1985, village_name: "Barrigada",
      gec_list_date: Date.new(2026, 1, 25), imported_at: 1.month.ago, status: "active"
    )
    GecVoter.create!(
      first_name: "Juan", last_name: "Cruz", birth_year: 1985, village_name: "Dededo",
      gec_list_date: Date.new(2026, 1, 25), imported_at: 1.month.ago, status: "active"
    )

    file = create_test_excel([
      [ "First Name", "Last Name", "Birth Year", "Village", "Reg No" ],
      [ "Juan", "Cruz", 1985, "Yigo", "VR001" ]
    ])

    result = GecImportService.new(
      file_path: file.path,
      gec_list_date: Date.new(2026, 2, 25),
      import_type: "changes_only"
    ).call

    assert result.success
    assert_equal 0, result.stats[:transferred]
    assert_equal 1, result.stats[:new]

    yigo_row = GecVoter.find_by(first_name: "Juan", last_name: "Cruz", village_name: "Yigo")
    assert_not_nil yigo_row
    assert_nil yigo_row.previous_village_name
  end

  test "full_list import re-flags verified supporters when voter is removed" do
    # GEC voter
    GecVoter.create!(
      first_name: "Juan", last_name: "Cruz", village_name: "Barrigada",
      gec_list_date: Date.new(2026, 1, 25), imported_at: 1.month.ago, status: "active"
    )

    # Verified supporter matching that voter — use update_columns to bypass auto-vet callback
    village = Village.find_or_create_by!(name: "Barrigada")
    supporter = Supporter.create!(
      first_name: "Juan", last_name: "Cruz", village: village,
      contact_number: "671-555-1234", status: "active",
      source: "staff_entry"
    )
    supporter.update_columns(verification_status: "verified", registered_voter: true)

    # New list without Juan
    file = create_test_excel([
      [ "First Name", "Last Name", "Date of Birth", "Village", "Reg No" ],
      [ "Maria", "Santos", Date.new(1990, 6, 20), "Barrigada", "VR002" ]
    ])

    result = GecImportService.new(
      file_path: file.path,
      gec_list_date: Date.new(2026, 2, 25),
      import_type: "full_list"
    ).call

    assert result.success
    assert_equal 1, result.stats[:re_vetted]

    supporter = Supporter.find_by(first_name: "Juan", last_name: "Cruz")
    assert_equal "flagged", supporter.verification_status
    assert_equal false, supporter.registered_voter
  end

  test "tracks matched_unchanged when re-importing identical data" do
    GecVoter.create!(
      first_name: "Juan",
      last_name: "Cruz",
      dob: Date.new(1985, 3, 15),
      birth_year: 1985,
      village_name: "Barrigada",
      gec_list_date: Date.new(2026, 2, 25),
      imported_at: 1.day.ago
    )

    file = create_test_excel([
      [ "First Name", "Last Name", "Date of Birth", "Village", "Reg No" ],
      [ "Juan", "Cruz", Date.new(1985, 3, 15), "Barrigada", nil ]
    ])

    result = GecImportService.new(
      file_path: file.path,
      gec_list_date: Date.new(2026, 2, 25),
      import_type: "changes_only"
    ).call

    assert result.success
    assert_equal 0, result.stats[:updated], "No fields changed, should not count as updated"
    assert_equal 1, result.stats[:matched_unchanged], "Should count as matched_unchanged"
    assert_equal 1, result.gec_import.metadata["matched_unchanged"]
  end

  test "dob ambiguity only change does not count as updated" do
    GecVoter.create!(
      first_name: "Ana",
      last_name: "Flores",
      dob: Date.new(1988, 3, 5),
      dob_ambiguous: false,
      birth_year: 1988,
      village_name: "Barrigada",
      gec_list_date: Date.new(2026, 1, 25),
      imported_at: 1.month.ago,
      status: "active"
    )

    file = create_test_excel([
      [ "First Name", "Last Name", "Date of Birth", "Village", "Reg No" ],
      [ "Ana", "Flores", Date.new(1988, 3, 5), "Barrigada", nil ]
    ])

    result = GecImportService.new(
      file_path: file.path,
      gec_list_date: Date.new(2026, 2, 25),
      import_type: "changes_only"
    ).call

    assert result.success
    assert_equal 0, result.stats[:updated], "DOB ambiguity-only change should not count as updated"
    assert_equal 1, result.stats[:matched_unchanged]
    assert_equal 0, result.gec_import.change_records.where(change_type: "updated").count

    voter = GecVoter.find_by!(first_name: "Ana", last_name: "Flores")
    assert voter.dob_ambiguous, "Parser confidence flag should still be updated on the record"
  ensure
    file&.close!
  end

  test "counts as updated when a field actually changes" do
    GecVoter.create!(
      first_name: "Juan",
      last_name: "Cruz",
      dob: Date.new(1985, 3, 15),
      village_name: "Barrigada",
      gec_list_date: Date.new(2026, 1, 25),
      imported_at: 1.month.ago
    )

    file = create_test_excel([
      [ "First Name", "Last Name", "Date of Birth", "Village", "Reg No" ],
      [ "Juan", "Cruz", Date.new(1985, 3, 15), "Barrigada", "VR-NEW" ]
    ])

    result = GecImportService.new(
      file_path: file.path,
      gec_list_date: Date.new(2026, 2, 25),
      import_type: "changes_only"
    ).call

    assert result.success
    assert_equal 1, result.stats[:updated], "VRN changed, should count as updated"
    assert_equal 0, result.stats[:matched_unchanged]
  end

  test "change_summary on gec_import returns correct data" do
    file = create_test_excel([
      [ "First Name", "Last Name", "Date of Birth", "Village", "Reg No" ],
      [ "Maria", "Santos", Date.new(1990, 6, 20), "Barrigada", "VR002" ]
    ])

    result = GecImportService.new(
      file_path: file.path,
      gec_list_date: Date.new(2026, 2, 25),
      import_type: "full_list"
    ).call

    summary = result.gec_import.change_summary
    assert_equal "full_list", summary[:import_type]
    assert_equal 1, summary[:total_records]
    assert_equal 1, summary[:new_records]
  end

  private

  def create_test_excel(rows)
    file = Tempfile.new([ "gec_test", ".xlsx" ])
    package = Axlsx::Package.new
    package.workbook.add_worksheet(name: "Voters") do |sheet|
      rows.each { |row| sheet.add_row(row) }
    end
    package.serialize(file.path)
    file
  end

  def create_test_csv(rows)
    file = Tempfile.new([ "gec_test", ".csv" ])
    CSV.open(file.path, "w") do |csv|
      rows.each { |row| csv << row }
    end
    file
  end
end
