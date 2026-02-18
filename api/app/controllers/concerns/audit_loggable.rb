# frozen_string_literal: true

# Shared audit logging helpers used across controllers that write AuditLog records.
module AuditLoggable
  extend ActiveSupport::Concern

  private

  def normalize_changed_data(changed_data)
    changed_data.each_with_object({}) do |(field, value), output|
      if value.is_a?(Array) && value.length == 2
        output[field] = { from: value[0], to: value[1] }
      else
        output[field] = { from: nil, to: value }
      end
    end
  end

  # Unified audit log writer. Override `audit_entry_mode` in controllers for custom entry_mode.
  def log_audit!(record, action:, changed_data:, entry_mode: nil, metadata: {})
    auditable = record || current_user
    auditable_type = record ? record.class.name : "User"

    AuditLog.create!(
      auditable: auditable,
      auditable_type: auditable_type,
      actor_user: current_user,
      action: action,
      changed_data: changed_data.is_a?(Hash) && changed_data.values.first.is_a?(Array) ? normalize_changed_data(changed_data) : changed_data,
      metadata: {
        entry_mode: entry_mode || audit_entry_mode,
        ip_address: request.remote_ip,
        user_agent: request.user_agent
      }.compact.merge(metadata)
    )
  end

  # Override in controllers for controller-specific entry_mode
  def audit_entry_mode
    nil
  end
end
