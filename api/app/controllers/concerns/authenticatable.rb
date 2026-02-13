# frozen_string_literal: true

require "net/http"
require "json"
require "jwt"

module Authenticatable
  extend ActiveSupport::Concern

  private

  def authenticate_request
    if Rails.env.test? && request.headers["X-Test-User-Id"].present?
      @current_user = User.find_by(id: request.headers["X-Test-User-Id"])
      unless @current_user
        render_api_error(
          message: "Invalid test user",
          status: :unauthorized,
          code: "invalid_test_user"
        )
      end
      return
    end

    token = extract_token
    unless token
      render_api_error(
        message: "Authorization token required",
        status: :unauthorized,
        code: "authorization_token_required"
      )
      return
    end

    begin
      decoded = decode_clerk_jwt(token)
      clerk_id = decoded["sub"]
      token_email = extract_token_email(decoded)

      @current_user = User.find_by(clerk_id: clerk_id)
      @current_user ||= find_or_link_user_by_email(clerk_id: clerk_id, token_email: token_email, decoded: decoded)

      # Auto-create user on first login if they have a Clerk account
      unless @current_user
        auto_provision = ActiveModel::Type::Boolean.new.cast(ENV.fetch("AUTO_PROVISION_USERS", "false"))
        unless auto_provision
          render_api_error(
            message: "User is not authorized for this application",
            status: :forbidden,
            code: "user_not_authorized"
          )
          return
        end

        @current_user = User.create!(
          clerk_id: clerk_id,
          email: token_email || "#{clerk_id}@clerk.dev",
          name: decoded["name"] || decoded["first_name"] || "New User",
          role: "block_leader"
        )
      end
    rescue JWT::DecodeError => e
      render_api_error(
        message: "Invalid token: #{e.message}",
        status: :unauthorized,
        code: "invalid_token"
      )
    rescue JWT::ExpiredSignature
      render_api_error(
        message: "Token expired",
        status: :unauthorized,
        code: "token_expired"
      )
    end
  end

  def current_user
    @current_user
  end

  def require_admin!
    unless current_user&.admin?
      render_api_error(
        message: "Admin access required",
        status: :forbidden,
        code: "admin_access_required"
      )
    end
  end

  def require_coordinator_or_above!
    unless current_user&.admin? || current_user&.coordinator?
      render_api_error(
        message: "Coordinator access required",
        status: :forbidden,
        code: "coordinator_access_required"
      )
    end
  end

  def extract_token
    header = request.headers["Authorization"]
    header&.split(" ")&.last
  end

  def decode_clerk_jwt(token)
    # Decode the Clerk publishable key to get the domain
    clerk_domain = extract_clerk_domain

    jwks_hash = clerk_jwks(clerk_domain)

    # Get the first key
    jwk_data = jwks_hash["keys"].first
    jwk = JWT::JWK.import(jwk_data)

    verify_aud = ENV["CLERK_JWT_AUDIENCE"].present?
    decoded = JWT.decode(
      token,
      jwk.public_key,
      true,
      {
        algorithm: "RS256",
        verify_iss: true,
        iss: "https://#{clerk_domain}",
        verify_aud: verify_aud,
        aud: ENV["CLERK_JWT_AUDIENCE"]
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

  def find_or_link_user_by_email(clerk_id:, token_email:, decoded:)
    return nil if token_email.blank?

    user = User.find_by(email: token_email)
    return nil unless user

    user.update!(
      clerk_id: clerk_id,
      name: decoded["name"] || decoded["first_name"] || user.name
    )
    user
  end

  def extract_token_email(decoded)
    raw = decoded["email"] ||
      decoded["email_address"] ||
      decoded.dig("primary_email_address", "email_address") ||
      decoded["https://clerk.dev/email"]

    raw&.downcase
  end

  def clerk_jwks(clerk_domain)
    Rails.cache.fetch("clerk_jwks:#{clerk_domain}", expires_in: 1.hour) do
      jwks_url = "https://#{clerk_domain}/.well-known/jwks.json"
      JSON.parse(Net::HTTP.get(URI(jwks_url)))
    end
  end
end
