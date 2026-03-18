require "test_helper"

class GecImportJobTest < ActiveSupport::TestCase
  test "does not preserve import artifact when import service fails" do
    gec_import = GecImport.create!(
      gec_list_date: Date.new(2026, 2, 25),
      filename: "voter_list.csv",
      import_type: "full_list",
      status: "pending",
      metadata: { "stage" => "queued", "progress_percent" => 0 }
    )
    upload = GecImportUpload.create!(
      gec_import: gec_import,
      filename: "voter_list.csv",
      content_type: "text/csv",
      file_data: "First Name,Last Name,Village\nJuan,Cruz,Barrigada\n"
    )

    fake_service = Object.new
    fake_service.define_singleton_method(:call) do
      GecImportService::Result.new(
        success: false,
        gec_import: gec_import,
        errors: [ "simulated import failure" ],
        stats: {}
      )
    end

    uploaded = []
    upload_stub = lambda do |key, data, **kwargs|
      uploaded << { key: key, data: data, kwargs: kwargs }
      key
    end

    with_singleton_stubs(GecImportService, new: fake_service) do
      with_singleton_stubs(S3Service, enabled?: true, upload: upload_stub) do
        GecImportJob.perform_now(
          gec_import_id: gec_import.id,
          upload_id: upload.id,
          gec_list_date: "2026-02-25"
        )
      end
    end

    gec_import.reload
    assert_equal "failed", gec_import.status
    assert_nil gec_import.original_file_s3_key
    assert_nil uploaded.find { |entry| entry[:key].include?("/artifact/") }
  end

  private

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
