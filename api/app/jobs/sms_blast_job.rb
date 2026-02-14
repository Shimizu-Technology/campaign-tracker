# frozen_string_literal: true

class SmsBlastJob < ApplicationJob
  queue_as :default

  def perform(message:, filters: {})
    return if message.blank?

    supporters = Supporter.active.where.not(contact_number: [ nil, "" ]).where(opt_in_text: true)
    supporters = supporters.where(village_id: filters["village_id"]) if filters["village_id"].present?
    supporters = supporters.where(motorcade_available: true) if filters["motorcade_available"] == "true"
    supporters = supporters.where(registered_voter: true) if filters["registered_voter"] == "true"
    supporters = supporters.where(yard_sign: true) if filters["yard_sign"] == "true"

    SmsService.blast(supporters, message)
  end
end
