# frozen_string_literal: true

module Authenticatable
  extend ActiveSupport::Concern

  private

  def authenticate_request
    token = extract_token
    unless token
      render json: { error: "Authorization token required" }, status: :unauthorized
      return
    end

    begin
      decoded = decode_clerk_jwt(token)
      clerk_id = decoded["sub"]
      @current_user = User.find_by(clerk_id: clerk_id)

      unless @current_user
        render json: { error: "User not found" }, status: :unauthorized
      end
    rescue JWT::DecodeError, JWT::ExpiredSignature => e
      render json: { error: "Invalid token: #{e.message}" }, status: :unauthorized
    end
  end

  def current_user
    @current_user
  end

  def require_admin!
    unless current_user&.admin?
      render json: { error: "Admin access required" }, status: :forbidden
    end
  end

  def require_coordinator_or_above!
    unless current_user&.admin? || current_user&.coordinator?
      render json: { error: "Coordinator access required" }, status: :forbidden
    end
  end

  def extract_token
    header = request.headers["Authorization"]
    header&.split(" ")&.last
  end

  def decode_clerk_jwt(token)
    # In development, allow a simple bypass
    if Rails.env.development? && ENV["DEV_BYPASS_AUTH"] == "true"
      return { "sub" => "dev_user" }
    end

    jwks_url = "https://#{ENV['CLERK_DOMAIN']}/.well-known/jwks.json"
    response = Net::HTTP.get(URI(jwks_url))
    jwks = JSON.parse(response)

    jwk = jwks["keys"].first
    key = JWT::JWK.import(jwk).public_key

    decoded = JWT.decode(token, key, true, { algorithm: "RS256" })
    decoded.first
  end
end
