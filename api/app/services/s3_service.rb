# frozen_string_literal: true

class S3Service
  BUCKET_NAME = ENV.fetch("AWS_S3_BUCKET", nil)
  REGION = ENV.fetch("AWS_REGION", "ap-southeast-2")

  MUTEX = Mutex.new

  class << self
    def enabled?
      BUCKET_NAME.present? &&
        ENV["AWS_ACCESS_KEY_ID"].present? &&
        ENV["AWS_SECRET_ACCESS_KEY"].present?
    end

    def s3_client
      return @s3_client if @s3_client

      MUTEX.synchronize do
        @s3_client ||= Aws::S3::Client.new(
          region: REGION,
          access_key_id: ENV.fetch("AWS_ACCESS_KEY_ID"),
          secret_access_key: ENV.fetch("AWS_SECRET_ACCESS_KEY")
        )
      end
    end

    # Upload file data (binary string) to S3
    def upload(key, data, content_type: "application/octet-stream")
      return nil unless enabled?

      s3_client.put_object(
        bucket: BUCKET_NAME,
        key: key,
        body: data,
        content_type: content_type,
        server_side_encryption: "AES256"
      )
      key
    rescue Aws::S3::Errors::ServiceError => e
      Rails.logger.error "[S3Service] Upload failed for #{key}: #{e.message}"
      nil
    end

    # Generate a presigned GET URL for temporary download access
    def presigned_url(key, expires_in: 3600, filename: nil)
      return nil unless enabled?

      presigner = Aws::S3::Presigner.new(client: s3_client)
      options = {
        bucket: BUCKET_NAME,
        key: key,
        expires_in: expires_in
      }
      if filename.present?
        escaped = filename.to_s.gsub(/["\\]/) { |ch| "\\#{ch}" }
        options[:response_content_disposition] = "attachment; filename=\"#{escaped}\""
      end
      presigner.presigned_url(:get_object, **options)
    rescue Aws::S3::Errors::ServiceError => e
      Rails.logger.error "[S3Service] Presigned URL failed for #{key}: #{e.message}"
      nil
    end

    # Delete an object from S3
    def delete(key)
      return true unless enabled?

      s3_client.delete_object(bucket: BUCKET_NAME, key: key)
      true
    rescue Aws::S3::Errors::ServiceError => e
      Rails.logger.error "[S3Service] Delete failed for #{key}: #{e.message}"
      false
    end
  end
end
