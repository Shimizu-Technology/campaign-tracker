require "test_helper"
require "tempfile"

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

    juan = GecVoter.find_by(first_name: "Juan")
    assert_equal "Dededo", juan.village_name
    assert_equal "Barrigada", juan.previous_village_name
    assert_equal "active", juan.status
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
end
