require "test_helper"
require "tempfile"

class Api::V1::GecVotersControllerTest < ActionDispatch::IntegrationTest
  setup do
    @village = Village.find_or_create_by!(name: "Barrigada")
    @admin = User.create!(
      clerk_id: "clerk-gec-test-admin-#{SecureRandom.hex(4)}",
      email: "gec-admin-#{SecureRandom.hex(4)}@example.com",
      name: "GEC Admin",
      role: "campaign_admin"
    )

    # Create some GEC voters for testing
    @gec_voter = GecVoter.create!(
      first_name: "Juan",
      last_name: "Cruz",
      dob: Date.new(1985, 3, 15),
      village_name: "Barrigada",
      voter_registration_number: "VR12345",
      gec_list_date: Date.new(2026, 1, 25),
      imported_at: Time.current
    )

    GecVoter.create!(
      first_name: "Maria",
      last_name: "Santos",
      dob: Date.new(1990, 6, 20),
      village_name: "Barrigada",
      gec_list_date: Date.new(2026, 1, 25),
      imported_at: Time.current
    )

    GecVoter.create!(
      first_name: "Pedro",
      last_name: "Reyes",
      dob: Date.new(1975, 11, 8),
      village_name: "Dededo",
      gec_list_date: Date.new(2026, 1, 25),
      imported_at: Time.current
    )
  end

  test "index returns paginated GEC voters" do
    get "/api/v1/gec_voters", headers: auth_headers(@admin)

    assert_response :success
    json = JSON.parse(response.body)
    assert json["gec_voters"].is_a?(Array)
    assert json["pagination"]["total"] >= 3
  end

  test "index filters by village" do
    get "/api/v1/gec_voters", params: { village: "Barrigada" }, headers: auth_headers(@admin)

    assert_response :success
    json = JSON.parse(response.body)
    json["gec_voters"].each do |voter|
      assert_equal "Barrigada", voter["village_name"]
    end
  end

  test "index filters by last name prefix" do
    get "/api/v1/gec_voters", params: { last_name: "Cru" }, headers: auth_headers(@admin)

    assert_response :success
    json = JSON.parse(response.body)
    assert json["gec_voters"].any? { |v| v["last_name"] == "Cruz" }
  end

  test "stats returns overview" do
    get "/api/v1/gec_voters/stats", headers: auth_headers(@admin)

    assert_response :success
    json = JSON.parse(response.body)
    assert json["total_voters"] >= 3
    assert json["villages"].is_a?(Array)
  end

  test "match finds exact match by name + dob + village" do
    post "/api/v1/gec_voters/match",
      params: { first_name: "Juan", last_name: "Cruz", dob: "1985-03-15", village_name: "Barrigada" },
      headers: auth_headers(@admin)

    assert_response :success
    json = JSON.parse(response.body)
    assert json["matches"].any? { |m| m["confidence"] == "exact" }
  end

  test "match detects different village (potential referral)" do
    post "/api/v1/gec_voters/match",
      params: { first_name: "Juan", last_name: "Cruz", dob: "1985-03-15", village_name: "Dededo" },
      headers: auth_headers(@admin)

    assert_response :success
    json = JSON.parse(response.body)
    assert json["matches"].any? { |m| m["match_type"] == "different_village" }
  end

  test "match returns empty for unknown person" do
    post "/api/v1/gec_voters/match",
      params: { first_name: "Nonexistent", last_name: "Person", dob: "2000-01-01", village_name: "Barrigada" },
      headers: auth_headers(@admin)

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal 0, json["matches"].size
  end

  test "upload requires admin" do
    non_admin = User.create!(
      clerk_id: "clerk-gec-nonadmin-#{SecureRandom.hex(4)}",
      email: "gec-nonadmin-#{SecureRandom.hex(4)}@example.com",
      name: "Regular User",
      role: "block_leader"
    )

    post "/api/v1/gec_voters/upload",
      params: { file: fixture_file_upload("test/fixtures/files/empty.txt", "text/plain"), gec_list_date: "2026-02-25" },
      headers: auth_headers(non_admin)

    assert_response :forbidden
  end

  test "imports lists past imports" do
    GecImport.create!(
      gec_list_date: Date.new(2026, 1, 25),
      filename: "gec_jan_2026.xlsx",
      status: "completed",
      total_records: 50000
    )

    get "/api/v1/gec_voters/imports", headers: auth_headers(@admin)

    assert_response :success
    json = JSON.parse(response.body)
    assert json["imports"].any?
  end

  test "imports includes uploaded_by_email" do
    GecImport.create!(
      gec_list_date: Date.new(2026, 1, 25),
      filename: "gec_jan_2026.xlsx",
      status: "completed",
      total_records: 50000,
      uploaded_by_user: @admin
    )

    get "/api/v1/gec_voters/imports", headers: auth_headers(@admin)

    assert_response :success
    json = JSON.parse(response.body)
    imp = json["imports"].first
    assert_equal @admin.email, imp["uploaded_by_email"]
  end

  test "imports includes transparency flags" do
    GecImport.create!(
      gec_list_date: Date.new(2026, 1, 25),
      filename: "gec_jan_2026.xlsx",
      status: "completed",
      total_records: 50000,
      raw_file_s3_key: "gec-imports/1/raw/gec_jan_2026.xlsx",
      raw_filename: "gec_jan_2026.xlsx",
      original_file_s3_key: "gec-imports/1/gec_jan_2026.xlsx",
      original_filename: "gec_jan_2026.xlsx"
    )

    get "/api/v1/gec_voters/imports", headers: auth_headers(@admin)

    assert_response :success
    json = JSON.parse(response.body)
    imp = json["imports"].first
    assert_equal true, imp["has_import_artifact"]
    assert_equal true, imp["has_original_file"]
    assert_equal true, imp["has_downloadable_file"]
  end

  test "preview returns fast sample metadata for pdf uploads" do
    file = Tempfile.new([ "gec_preview", ".pdf" ])
    file.binmode
    file.write("%PDF-1.4 sample")
    file.rewind

    fake_result = GecPdfParserService::Result.new(
      rows: [
        {
          "name" => "JUAN CRUZ",
          "village" => "Barrigada",
          "voter_registration_number" => "96001",
          "birth_year" => "1985"
        }
      ],
      qa: {
        status: "preview",
        row_count: 1,
        quality_score: nil,
        preview_mode: true,
        note: "Sample preview only. Full PDF validation runs during import.",
        pages_sampled: 1,
        page_count: 20
      },
      warnings: [],
      errors: []
    )

    fake_parser = Object.new
    fake_parser.define_singleton_method(:parse_preview_sample) { fake_result }

    with_singleton_stubs(GecPdfParserService, new: fake_parser) do
      post "/api/v1/gec_voters/preview",
        params: {
          file: Rack::Test::UploadedFile.new(file.path, "application/pdf", original_filename: "gec_list.pdf")
        },
        headers: auth_headers(@admin)
    end

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal "pdf", json["source_type"]
    assert_equal "preview", json["qa"]["status"]
    assert_equal true, json["qa"]["preview_mode"]
    assert_nil json["parse_cache_key"]
    assert_equal "JUAN CRUZ", json["preview_rows"][0]["name"]
  ensure
    file&.close!
  end

  test "async pdf upload queues immediately without parsing in controller" do
    file = Tempfile.new([ "gec_async_pdf", ".pdf" ])
    file.binmode
    file.write("%PDF-1.4 sample")
    file.rewind

    with_singleton_stubs(S3Service, enabled?: false) do
      with_singleton_stubs(GecPdfParserService, new: ->(*_args, **_kwargs) { raise "controller should not parse async pdf uploads" }) do
        assert_enqueued_jobs 1, only: GecImportJob do
          post "/api/v1/gec_voters/upload",
            params: {
              file: Rack::Test::UploadedFile.new(file.path, "application/pdf", original_filename: "voter_list.pdf"),
              gec_list_date: "2026-02-25",
              async_import: "true"
            },
            headers: auth_headers(@admin)
        end
      end
    end

    assert_response :accepted
    json = JSON.parse(response.body)
    imp = GecImport.find(json["import"]["id"])
    payload = GecImportUpload.find_by!(gec_import_id: imp.id)

    assert_equal "voter_list.csv", imp.filename
    assert_equal "voter_list.pdf", payload.filename
    assert_equal "application/pdf", payload.content_type
    assert_equal "queued", imp.metadata["stage"]
  ensure
    file&.close!
  end

  test "view_import_data returns parsed spreadsheet preview for existing import" do
    file = create_test_excel([
      [ "First Name", "Last Name", "Village", "Reg No" ],
      [ "Juan", "Cruz", "Barrigada", "VR001" ],
      [ "Maria", "Santos", "Dededo", "VR002" ]
    ])

    gec_import = GecImport.create!(
      gec_list_date: Date.new(2026, 1, 25),
      filename: "gec_jan_2026.xlsx",
      status: "completed",
      total_records: 2,
      original_file_s3_key: "gec-imports/1/artifact/gec_jan_2026.xlsx",
      original_filename: "gec_jan_2026.xlsx"
    )

    with_singleton_stubs(S3Service, download: File.binread(file.path)) do
      get "/api/v1/gec_voters/imports/#{gec_import.id}/view_data", headers: auth_headers(@admin)
    end

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal "spreadsheet", json["preview"]["source_type"]
    assert_equal 2, json["preview"]["row_count"]
    assert_equal 1, json["preview"]["pagination"]["page"]
    assert_equal 2, json["preview"]["pagination"]["total_rows"]
    assert_equal "Juan", json["preview"]["preview_rows"][0]["first_name"]
  ensure
    file&.close!
  end

  test "view_import_data paginates parsed rows" do
    file = create_test_excel([
      [ "First Name", "Last Name", "Village", "Reg No" ],
      [ "Juan", "Cruz", "Barrigada", "VR001" ],
      [ "Maria", "Santos", "Dededo", "VR002" ],
      [ "Pedro", "Reyes", "Yigo", "VR003" ]
    ])

    gec_import = GecImport.create!(
      gec_list_date: Date.new(2026, 1, 25),
      filename: "gec_jan_2026.xlsx",
      status: "completed",
      total_records: 3,
      original_file_s3_key: "gec-imports/1/artifact/gec_jan_2026.xlsx",
      original_filename: "gec_jan_2026.xlsx"
    )

    with_singleton_stubs(S3Service, download: File.binread(file.path)) do
      get "/api/v1/gec_voters/imports/#{gec_import.id}/view_data",
        params: { page: 2, per_page: 1 },
        headers: auth_headers(@admin)
    end

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal 2, json["preview"]["pagination"]["page"]
    assert_equal 3, json["preview"]["pagination"]["total_pages"]
    assert_equal 1, json["preview"]["preview_rows"].length
    assert_equal "Maria", json["preview"]["preview_rows"][0]["first_name"]
  ensure
    file&.close!
  end

  test "view_import_data supports search and village filters" do
    file = create_test_excel([
      [ "First Name", "Last Name", "Village", "Reg No" ],
      [ "Juan", "Cruz", "Barrigada", "VR001" ],
      [ "Maria", "Santos", "Dededo", "VR002" ],
      [ "Pedro", "Reyes", "Dededo", "VR003" ]
    ])

    gec_import = GecImport.create!(
      gec_list_date: Date.new(2026, 1, 25),
      filename: "gec_jan_2026.xlsx",
      status: "completed",
      total_records: 3,
      original_file_s3_key: "gec-imports/1/artifact/gec_jan_2026.xlsx",
      original_filename: "gec_jan_2026.xlsx"
    )

    with_singleton_stubs(S3Service, download: File.binread(file.path)) do
      get "/api/v1/gec_voters/imports/#{gec_import.id}/view_data",
        params: { q: "pedro", village: "Dededo" },
        headers: auth_headers(@admin)
    end

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal [ "Barrigada", "Dededo" ], json["preview"]["available_villages"]
    assert_equal 1, json["preview"]["pagination"]["total_rows"]
    assert_equal "Pedro", json["preview"]["preview_rows"][0]["first_name"]
  ensure
    file&.close!
  end

  test "view_import_data caches parsed viewer rows across requests" do
    skip "Test environment cache store does not persist viewer cache" if Rails.cache.class.name.include?("NullStore")

    file = create_test_excel([
      [ "First Name", "Last Name", "Village", "Reg No" ],
      [ "Juan", "Cruz", "Barrigada", "VR001" ],
      [ "Maria", "Santos", "Dededo", "VR002" ]
    ])

    gec_import = GecImport.create!(
      gec_list_date: Date.new(2026, 1, 25),
      filename: "gec_jan_2026.xlsx",
      status: "completed",
      total_records: 2,
      original_file_s3_key: "gec-imports/1/artifact/gec_jan_2026.xlsx",
      original_filename: "gec_jan_2026.xlsx"
    )

    download_count = 0
    downloader = lambda do |_key|
      download_count += 1
      File.binread(file.path)
    end

    Rails.cache.clear
    with_singleton_stubs(S3Service, download: downloader) do
      get "/api/v1/gec_voters/imports/#{gec_import.id}/view_data",
        params: { page: 1, per_page: 1 },
        headers: auth_headers(@admin)
      get "/api/v1/gec_voters/imports/#{gec_import.id}/view_data",
        params: { page: 2, per_page: 1 },
        headers: auth_headers(@admin)
    end

    assert_equal 1, download_count
  ensure
    Rails.cache.clear
    file&.close!
  end

  test "view_import_changes returns persisted change rows with counts" do
    gec_import = GecImport.create!(
      gec_list_date: Date.new(2026, 1, 25),
      filename: "gec_jan_2026.xlsx",
      status: "completed",
      total_records: 3,
      new_records: 1,
      updated_records: 1,
      removed_records: 1
    )

    GecImportChange.create!(
      gec_import: gec_import,
      change_type: "new",
      first_name: "Juan",
      last_name: "Cruz",
      village_name: "Barrigada",
      voter_registration_number: "VR001"
    )
    GecImportChange.create!(
      gec_import: gec_import,
      change_type: "updated",
      first_name: "Maria",
      last_name: "Santos",
      village_name: "Dededo",
      voter_registration_number: "VR002",
      details: {
        changed_fields: {
          voter_registration_number: {
            before: nil,
            after: "VR002"
          }
        }
      }
    )
    GecImportChange.create!(
      gec_import: gec_import,
      change_type: "removed",
      first_name: "Pedro",
      last_name: "Reyes",
      village_name: "Yigo",
      voter_registration_number: "VR003"
    )

    get "/api/v1/gec_voters/imports/#{gec_import.id}/changes", headers: auth_headers(@admin)

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal 3, json["counts"]["all"]
    assert_equal 1, json["counts"]["new"]
    assert_equal 1, json["counts"]["changed"]
    assert_equal 3, json["pagination"]["total_rows"]
    assert_equal "Pedro", json["changes"].first["first_name"]
  end

  test "view_import_changes filters by changed category and search query" do
    gec_import = GecImport.create!(
      gec_list_date: Date.new(2026, 1, 25),
      filename: "gec_jan_2026.xlsx",
      status: "completed",
      total_records: 2,
      updated_records: 1,
      transferred_records: 1
    )

    GecImportChange.create!(
      gec_import: gec_import,
      change_type: "updated",
      first_name: "Maria",
      last_name: "Santos",
      village_name: "Dededo",
      voter_registration_number: "VR002"
    )
    GecImportChange.create!(
      gec_import: gec_import,
      change_type: "transferred",
      first_name: "Juan",
      last_name: "Cruz",
      village_name: "Yigo",
      previous_village_name: "Barrigada",
      voter_registration_number: "VR001"
    )

    get "/api/v1/gec_voters/imports/#{gec_import.id}/changes",
      params: { type: "changed", q: "juan" },
      headers: auth_headers(@admin)

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal "changed", json["filters"]["type"]
    assert_equal "juan", json["filters"]["q"]
    assert_equal 1, json["pagination"]["total_rows"]
    assert_equal "transferred", json["changes"].first["change_type"]
  end

  test "view_import_changes clamps requested page to total_pages" do
    gec_import = GecImport.create!(
      gec_list_date: Date.new(2026, 1, 25),
      filename: "gec_jan_2026.xlsx",
      status: "completed",
      total_records: 1,
      new_records: 1
    )

    GecImportChange.create!(
      gec_import: gec_import,
      change_type: "new",
      first_name: "Juan",
      last_name: "Cruz",
      village_name: "Barrigada",
      voter_registration_number: "VR001"
    )

    get "/api/v1/gec_voters/imports/#{gec_import.id}/changes",
      params: { page: 999, per_page: 100 },
      headers: auth_headers(@admin)

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal 1, json["pagination"]["total_pages"]
    assert_equal 1, json["pagination"]["page"]
    assert_equal 1, json["changes"].length
  end

  test "view_original returns inline viewer metadata for preserved raw pdf" do
    gec_import = GecImport.create!(
      gec_list_date: Date.new(2026, 1, 25),
      filename: "gec_jan_2026.csv",
      status: "completed",
      total_records: 50000,
      raw_file_s3_key: "gec-imports/1/raw/gec_jan_2026.pdf",
      raw_filename: "gec_jan_2026.pdf",
      raw_content_type: "application/pdf"
    )

    calls = []
    presign = lambda do |key, **kwargs|
      calls << { key: key, kwargs: kwargs }
      "https://example.test/original.pdf"
    end

    with_singleton_stubs(S3Service, presigned_url: presign) do
      get "/api/v1/gec_voters/imports/#{gec_import.id}/view_original", headers: auth_headers(@admin)
    end

    assert_response :success
    json = JSON.parse(response.body)
    assert_equal true, json["inline_supported"]
    assert_equal "application/pdf", json["content_type"]
    assert_equal 1800, calls.first[:kwargs][:expires_in]
  end

  test "download_import prefers raw file when available" do
    gec_import = GecImport.create!(
      gec_list_date: Date.new(2026, 1, 25),
      filename: "gec_jan_2026.csv",
      status: "completed",
      total_records: 50000,
      raw_file_s3_key: "gec-imports/1/raw/gec_jan_2026.pdf",
      raw_filename: "gec_jan_2026.pdf",
      original_file_s3_key: "gec-imports/1/artifact/gec_jan_2026.csv",
      original_filename: "gec_jan_2026.csv"
    )

    calls = []
    presign = lambda do |key, **kwargs|
      calls << { key: key, kwargs: kwargs }
      "https://example.test/download"
    end

    with_singleton_stubs(S3Service, presigned_url: presign) do
      get "/api/v1/gec_voters/imports/#{gec_import.id}/download", headers: auth_headers(@admin)
    end

    assert_response :success
    assert_equal "gec-imports/1/raw/gec_jan_2026.pdf", calls.first[:key]
  end

  test "async upload preserves raw file metadata and import artifact" do
    file = create_test_excel([
      [ "First Name", "Last Name", "Village", "Reg No" ],
      [ "Juan", "Cruz", "Barrigada", "VR001" ]
    ])

    uploaded_keys = []
    upload = lambda do |key, _data, **_kwargs|
      uploaded_keys << key
      key
    end

    with_singleton_stubs(S3Service, enabled?: true, upload: upload) do
      perform_enqueued_jobs do
        post "/api/v1/gec_voters/upload",
          params: {
            file: Rack::Test::UploadedFile.new(file.path, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", original_filename: "gec_upload.xlsx"),
            gec_list_date: "2026-02-25",
            async_import: "true"
          },
          headers: auth_headers(@admin)
      end
    end

    assert_response :accepted
    json = JSON.parse(response.body)
    imp = GecImport.find(json["import"]["id"])
    assert_equal "gec_upload.xlsx", imp.raw_filename
    assert imp.raw_file_s3_key.present?
    assert imp.original_file_s3_key.present?
    assert uploaded_keys.any? { |key| key.include?("/raw/") }
    assert uploaded_keys.any? { |key| key.include?("/artifact/") }
  ensure
    file&.close!
  end

  test "download_import returns service_unavailable when S3 not configured" do
    gec_import = GecImport.create!(
      gec_list_date: Date.new(2026, 1, 25),
      filename: "gec_jan_2026.xlsx",
      status: "completed",
      total_records: 50000,
      original_file_s3_key: "gec-imports/1/gec_jan_2026.xlsx",
      original_filename: "gec_jan_2026.xlsx"
    )

    with_singleton_stubs(S3Service, presigned_url: nil) do
      get "/api/v1/gec_voters/imports/#{gec_import.id}/download", headers: auth_headers(@admin)
    end

    assert_response :service_unavailable
    json = JSON.parse(response.body)
    assert_equal "s3_error", json["code"]
  end

  test "download_import returns 404 when no original file" do
    gec_import = GecImport.create!(
      gec_list_date: Date.new(2026, 1, 25),
      filename: "gec_jan_2026.xlsx",
      status: "completed",
      total_records: 50000
    )

    get "/api/v1/gec_voters/imports/#{gec_import.id}/download", headers: auth_headers(@admin)

    assert_response :not_found
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

  def with_singleton_stubs(klass, stubs)
    singleton = class << klass; self; end
    originals = {}

    stubs.each do |method_name, replacement|
      originals[method_name] = singleton.instance_method(method_name) if singleton.method_defined?(method_name)
      singleton.define_method(method_name) do |*args, **kwargs, &block|
        if replacement.respond_to?(:call)
          replacement.call(*args, **kwargs, &block)
        else
          replacement
        end
      end
    end

    yield
  ensure
    stubs.each_key do |method_name|
      singleton.send(:remove_method, method_name) if singleton.method_defined?(method_name)
      singleton.define_method(method_name, originals[method_name]) if originals[method_name]
    end
  end
end
