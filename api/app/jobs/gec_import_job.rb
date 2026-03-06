# frozen_string_literal: true

class GecImportJob < ApplicationJob
  queue_as :default

  # Advisory lock keys for GEC imports (2-key form for portability).
  # Convention: key1 = subsystem ID (81 = GEC), key2 = operation (1 = import).
  # These are application-global PostgreSQL advisory locks. If you add other
  # advisory locks elsewhere in this codebase, choose different key1/key2
  # values to avoid collisions. See: db/advisory_lock_registry.md
  IMPORT_LOCK_KEY_1 = 81
  IMPORT_LOCK_KEY_2 = 1
  # 20 retries with exponential backoff (30s, 60s, 120s, ..., capped at 5 min)
  # gives ~30+ minutes total wait — enough for a full 60K-row import to finish.
  MAX_IMPORT_REQUEUE_ATTEMPTS = 20

  # Process-level mutex to prevent concurrent imports within the same multi-threaded
  # worker (e.g. Sidekiq). pg_try_advisory_lock is session-level and each thread gets
  # its own DB connection, so two threads in the same process could both acquire the
  # lock. This mutex gates access before the DB lock for belt-and-suspenders safety.
  IMPORT_MUTEX = Mutex.new

  def perform(gec_import_id:, upload_id:, gec_list_date:, uploaded_by_user_id: nil, sheet_name: nil, import_type: "full_list")
    gec_import = GecImport.find_by(id: gec_import_id)
    # Load metadata only (no file_data blob) for guard checks and lock contention path.
    # The full blob is loaded only after both locks are acquired to avoid holding
    # 10-50 MB in Ruby heap while waiting for requeue.
    upload_meta = GecImportUpload.where(id: upload_id).select(:id, :gec_import_id, :filename, :content_type).first

    if gec_import.nil? || %w[completed failed processing].include?(gec_import.status)
      GecImportUpload.where(id: upload_id).delete_all
      return
    end

    unless upload_meta
      gec_import.update!(
        status: "failed",
        metadata: (gec_import.metadata || {}).merge({ "stage" => "failed", "progress_percent" => 100, "error" => "Missing upload payload" })
      )
      return
    end

    user = uploaded_by_user_id.present? ? User.find_by(id: uploaded_by_user_id) : nil
    tmp_file_path = nil
    lock_acquired = false
    mutex_acquired = false
    should_destroy_upload = true

    begin
      # Layer 1: Process-level mutex (protects against multi-threaded workers like Sidekiq)
      mutex_acquired = IMPORT_MUTEX.try_lock
      unless mutex_acquired
        requeued = handle_lock_contention(gec_import, gec_import_id, upload_id, gec_list_date, uploaded_by_user_id, sheet_name, import_type)
        should_destroy_upload = !requeued # destroy upload if permanently failed
        return
      end

      # Layer 2: DB advisory lock (protects across separate worker processes/dynos)
      lock_result = ActiveRecord::Base.connection.select_value("SELECT pg_try_advisory_lock(#{IMPORT_LOCK_KEY_1}, #{IMPORT_LOCK_KEY_2})")
      lock_acquired = ActiveModel::Type::Boolean.new.cast(lock_result)
      unless lock_acquired
        requeued = handle_lock_contention(gec_import, gec_import_id, upload_id, gec_list_date, uploaded_by_user_id, sheet_name, import_type)
        should_destroy_upload = !requeued
        return
      end

      gec_import.update!(
        status: "processing",
        metadata: (gec_import.metadata || {}).merge({ "stage" => "parsing", "progress_percent" => 5 })
      )

      # Now load the full binary blob — only after both locks are held.
      upload = GecImportUpload.find(upload_id)

      tmp = Tempfile.new([ "gec_import", ".tmp" ])
      tmp.binmode
      tmp.write(upload.file_data)
      tmp.flush
      tmp_file_path = tmp.path
      tmp.close

      service = GecImportService.new(
        file_path: tmp_file_path,
        gec_list_date: Date.parse(gec_list_date),
        uploaded_by_user: user,
        sheet_name: sheet_name,
        import_type: import_type,
        gec_import: gec_import
      )

      result = service.call

      unless result.success
        Rails.logger.error("GecImportJob: service returned failure for import ##{gec_import_id}: #{result.errors.first}")
      end

      if result.success
        begin
          AuditLog.create(
            auditable: result.gec_import,
            auditable_type: result.gec_import.class.name,
            actor_user: user,
            action: "gec_import",
            changed_data: result.stats,
            metadata: {
              entry_mode: "async_import_job",
              context: "background_job",
              request_context_available: false,
              source: "gec_import_job",
              uploaded_by_user_id: user&.id,
              uploaded_by_user_email: user&.email,
              import_type: import_type,
              gec_list_date: gec_list_date
            }
          )
        rescue StandardError => e
          Rails.logger.warn("Async import audit log failed for #{gec_import.id}: #{e.message}")
        end
      end
    rescue StandardError => e
      gec_import&.update!(
        status: "failed",
        metadata: (gec_import&.metadata || {}).merge({ "stage" => "failed", "progress_percent" => 100, "error" => e.message })
      )
      Rails.logger.error("GecImportJob failed for #{gec_import_id}: #{e.class}: #{e.message}")
    ensure
      File.delete(tmp_file_path) if tmp_file_path.present? && File.exist?(tmp_file_path)
      GecImportUpload.where(id: upload_id).delete_all if should_destroy_upload
      if lock_acquired
        begin
          ActiveRecord::Base.connection.execute("SELECT pg_advisory_unlock(#{IMPORT_LOCK_KEY_1}, #{IMPORT_LOCK_KEY_2})")
        rescue StandardError => e
          Rails.logger.warn("GecImportJob #{gec_import_id}: advisory unlock failed: #{e.class}: #{e.message}")
        end
      end
      IMPORT_MUTEX.unlock if mutex_acquired
    end
  end

  private

  # Returns true if job was re-queued (upload still needed), false if permanently failed (upload can be cleaned up).
  def handle_lock_contention(gec_import, gec_import_id, upload_id, gec_list_date, uploaded_by_user_id, sheet_name, import_type)
    requeue_count = (gec_import.metadata || {})["requeue_count"].to_i
    if requeue_count >= MAX_IMPORT_REQUEUE_ATTEMPTS
      gec_import.update!(
        status: "failed",
        metadata: (gec_import.metadata || {}).merge({
          "stage" => "failed",
          "progress_percent" => 100,
          "error" => "Exceeded import lock requeue limit (#{MAX_IMPORT_REQUEUE_ATTEMPTS})"
        })
      )
      return false # permanently done — caller should clean up upload
    end

    wait_seconds = [ 30 * (2**requeue_count), 300 ].min # exponential backoff, capped at 5 minutes
    Rails.logger.warn("GecImportJob #{gec_import_id}: import lock busy for #{import_type}, retrying in #{wait_seconds}s (#{requeue_count + 1}/#{MAX_IMPORT_REQUEUE_ATTEMPTS})")
    gec_import.update!(
      status: "pending",
      metadata: (gec_import.metadata || {}).merge({
        "stage" => "queued",
        "progress_percent" => 0,
        "note" => "Waiting for another import to finish (retry #{requeue_count + 1}/#{MAX_IMPORT_REQUEUE_ATTEMPTS})",
        "requeue_count" => requeue_count + 1
      })
    )
    self.class.set(wait: wait_seconds.seconds).perform_later(
      gec_import_id: gec_import_id,
      upload_id: upload_id,
      gec_list_date: gec_list_date,
      uploaded_by_user_id: uploaded_by_user_id,
      sheet_name: sheet_name,
      import_type: import_type
    )
    true # re-queued — upload still needed
  end
end
