# frozen_string_literal: true

require "net/http"
require "json"
require "jwt"

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

      # Auto-create user on first login if they have a Clerk account
      unless @current_user
        @current_user = User.create!(
          clerk_id: clerk_id,
          email: decoded["email"] || "#{clerk_id}@clerk.dev",
          name: decoded["name"] || decoded["first_name"] || "New User",
          role: "block_leader" # Default role, admin upgrades later
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
    # Decode the Clerk publishable key to get the domain
    # pk_test_dHJ1c3RlZC1tb29zZS04LmNsZXJrLmFjY291bnRzLmRldiQ
    # Base64 decodes to: trusted-moose-8.clerk.accounts.dev$
    clerk_domain = extract_clerk_domain

    jwks_url = "https://#{clerk_domain}/.well-known/jwks.json"
    uri = URI(jwks_url)
    response = Net::HTTP.get(uri)
    jwks_hash = JSON.parse(response)

    # Get the first key
    jwk_data = jwks_hash["keys"].first
    jwk = JWT::JWK.import(jwk_data)

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

  def extract_clerk_domain
    pk = ENV["CLERK_PUBLISHABLE_KEY"] || ""
    # Remove pk_test_ or pk_live_ prefix
    encoded = pk.sub(/^pk_(test|live)_/, "")
    # Base64 decode to get domain (ends with $)
    decoded = Base64.decode64(encoded).chomp("$")
    decoded
  end
end
