# frozen_string_literal: true

require "net/http"
require "json"
require "jwt"

module Authenticatable
  extend ActiveSupport::Concern

  JWKS_CACHE = { key: nil, fetched_at: nil }
  JWKS_CACHE_TTL = 3600 # 1 hour

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

      # Auto-create user on first login if they have a Clerk account
      unless @current_user
        clerk_user = fetch_clerk_user(clerk_id)
        email = clerk_user[:email] || "#{clerk_id}@clerk.dev"
        admin_emails = ENV.fetch("ADMIN_EMAILS", "lmshimizu@gmail.com").split(",").map(&:strip)
        role = admin_emails.include?(email) ? "campaign_admin" : "block_leader"

        @current_user = User.create!(
          clerk_id: clerk_id,
          email: email,
          name: clerk_user[:name] || "New User",
          role: role
        )
      end
    rescue JWT::DecodeError => e
      render json: { error: "Invalid token: #{e.message}" }, status: :unauthorized
    rescue JWT::ExpiredSignature
      render json: { error: "Token expired" }, status: :unauthorized
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
    jwk = cached_clerk_jwk

    decoded = JWT.decode(
      token,
      jwk.public_key,
      true,
      {
        algorithm: "RS256",
        verify_iss: false,
        verify_aud: false
      }
    )

    decoded.first
  end

  def cached_clerk_jwk
    cache = JWKS_CACHE
    if cache[:key] && cache[:fetched_at] && (Time.now - cache[:fetched_at]) < JWKS_CACHE_TTL
      return cache[:key]
    end

    clerk_domain = extract_clerk_domain
    jwks_url = "https://#{clerk_domain}/.well-known/jwks.json"
    uri = URI(jwks_url)
    response = Net::HTTP.get(uri)
    jwks_hash = JSON.parse(response)
    jwk_data = jwks_hash["keys"].first
    jwk = JWT::JWK.import(jwk_data)

    cache[:key] = jwk
    cache[:fetched_at] = Time.now
    jwk
  end

  def fetch_clerk_user(clerk_id)
    secret_key = ENV["CLERK_SECRET_KEY"]
    return { email: nil, name: nil } unless secret_key.present?

    uri = URI("https://api.clerk.com/v1/users/#{clerk_id}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    req = Net::HTTP::Get.new(uri)
    req["Authorization"] = "Bearer #{secret_key}"

    response = http.request(req)
    return { email: nil, name: nil } unless response.is_a?(Net::HTTPSuccess)

    data = JSON.parse(response.body)
    primary_email = data.dig("email_addresses")&.find { |e| e["id"] == data["primary_email_address_id"] }
    email = primary_email&.dig("email_address")
    first_name = data["first_name"]
    last_name = data["last_name"]
    name = [first_name, last_name].compact.join(" ").presence

    { email: email, name: name }
  rescue StandardError => e
    Rails.logger.warn("Failed to fetch Clerk user #{clerk_id}: #{e.message}")
    { email: nil, name: nil }
  end

  def extract_clerk_domain
    pk = ENV["CLERK_PUBLISHABLE_KEY"] || ""
    # Remove pk_test_ or pk_live_ prefix
    encoded = pk.sub(/^pk_(test|live)_/, "")
    # Base64 decode to get domain (ends with $)
    decoded = Base64.decode64(encoded).chomp("$")
    decoded
  end
end
