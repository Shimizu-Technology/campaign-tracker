# frozen_string_literal: true

class UserInviteEmailService
  class << self
    def send_invite(user:, invited_by:)
      return false unless configured?

      response = Resend::Emails.send(
        {
          from: from_email,
          to: user.email,
          subject: "Create your Campaign Tracker account",
          html: invite_html(user: user, invited_by: invited_by)
        }
      )

      Rails.logger.info("[InviteEmail] sent invite to #{user.email} response=#{response.inspect}")
      true
    rescue StandardError => e
      Rails.logger.error("[InviteEmail] failed for #{user.email}: #{e.class} #{e.message}")
      false
    end

    def configured?
      if ENV["RESEND_API_KEY"].blank?
        Rails.logger.warn("[InviteEmail] RESEND_API_KEY not configured; skipping invite email")
        return false
      end

      if from_email.blank?
        Rails.logger.warn("[InviteEmail] RESEND_FROM_EMAIL/MAILER_FROM_EMAIL missing; skipping invite email")
        return false
      end

      true
    end

    private

    def from_email
      ENV["RESEND_FROM_EMAIL"].presence || ENV["MAILER_FROM_EMAIL"].presence
    end

    def frontend_url
      ENV["FRONTEND_URL"].presence || "http://localhost:5175"
    end

    def role_label(role)
      role.to_s.tr("_", " ")
    end

    def invite_html(user:, invited_by:)
      inviter = invited_by&.name.presence || invited_by&.email.presence || "a campaign admin"
      role = role_label(user.role).split.map(&:capitalize).join(" ")

      <<~HTML
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Campaign Tracker Invite</title>
          </head>
          <body style="margin: 0; padding: 0; background: #f3f5fb; color: #1f2937; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding: 28px 12px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 620px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden;">
                    <tr>
                      <td style="background: #1B3A6B; padding: 20px 24px;">
                        <p style="margin: 0; color: #bfdbfe; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase;">Campaign Ops Platform</p>
                        <h1 style="margin: 6px 0 0 0; color: #ffffff; font-size: 24px; line-height: 1.2;">You're invited to Campaign Tracker</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 24px;">
                        <p style="margin: 0 0 12px 0; font-size: 16px;">#{inviter} added you as <strong>#{role}</strong>.</p>
                        <p style="margin: 0 0 16px 0; font-size: 15px; color: #4b5563;">
                          Create your account using this invited email address:
                          <strong>#{user.email}</strong>
                        </p>
                        <p style="margin: 0 0 16px 0; font-size: 14px; color: #4b5563;">
                          After opening the portal, choose <strong>Sign up</strong> if this is your first time.
                        </p>

                        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 0 18px 0;">
                          <tr>
                            <td style="border-radius: 10px; background: #1B3A6B;">
                              <a href="#{frontend_url}/admin" target="_blank" style="display: inline-block; padding: 12px 18px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600;">
                                Create Account
                              </a>
                            </td>
                          </tr>
                        </table>

                        <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">
                          Or copy this URL into your browser:
                        </p>
                        <p style="margin: 0 0 20px 0; font-size: 13px; color: #1B3A6B; word-break: break-all;">
                          #{frontend_url}/admin
                        </p>

                        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 0 0 14px 0;">
                        <p style="margin: 0; font-size: 12px; color: #6b7280;">
                          If you already created your account, you can sign in normally.
                        </p>
                        <p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280;">
                          If you were not expecting this invite, you can ignore this email.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      HTML
    end
  end
end
