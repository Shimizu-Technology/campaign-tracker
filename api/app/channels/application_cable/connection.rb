# frozen_string_literal: true

module ApplicationCable
  class Connection < ActionCable::Connection::Base
    # For now, allow all connections (auth via Clerk JWT can be added later)
    # In production, verify JWT from query params or cookies
  end
end
