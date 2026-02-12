# frozen_string_literal: true

# Single channel for all real-time campaign updates.
# Clients subscribe and receive typed events they can filter on.
class CampaignChannel < ApplicationCable::Channel
  def subscribed
    stream_from "campaign_updates"
  end

  def unsubscribed
    # cleanup if needed
  end
end
