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
end
