# frozen_string_literal: true

class SupporterEmailService
  class << self
    # Send welcome email to a new supporter who opted in to email updates.
    def send_welcome(supporter)
      return false unless configured?
      return false if supporter.email.blank?

      body = welcome_html(supporter)
      response = Resend::Emails.send(
        {
          from: from_email,
          to: supporter.email,
          subject: "Si Yu'os Ma'åse for supporting Josh & Tina!",
          html: body
        }
      )

      Rails.logger.info("[SupporterEmail] welcome sent to #{supporter.email} response=#{response.inspect}")
      true
    rescue StandardError => e
      Rails.logger.error("[SupporterEmail] welcome failed for #{supporter.email}: #{e.class} #{e.message}")
      false
    end

    # Send a blast email to multiple supporters.
    # Returns { sent: count, failed: count, errors: [] }
    def send_blast(subject:, body_html:, supporters:)
      return { sent: 0, failed: 0, errors: [ "Email not configured" ] } unless configured?

      sent = 0
      failed = 0
      errors = []

      supporters.find_each do |supporter|
        next if supporter.email.blank?

        begin
          personalized = personalize(body_html, supporter)
          Resend::Emails.send(
            {
              from: from_email,
              to: supporter.email,
              subject: personalize(subject, supporter),
              html: blast_wrapper_html(personalized)
            }
          )
          sent += 1
        rescue StandardError => e
          failed += 1
          errors << "#{supporter.email}: #{e.message}" if errors.length < 10
          Rails.logger.error("[SupporterEmail] blast failed for #{supporter.email}: #{e.class} #{e.message}")
        end
      end

      { sent: sent, failed: failed, errors: errors }
    end

    def configured?
      if ENV["RESEND_API_KEY"].blank?
        Rails.logger.warn("[SupporterEmail] RESEND_API_KEY not configured; skipping email")
        return false
      end

      if from_email.blank?
        Rails.logger.warn("[SupporterEmail] RESEND_FROM_EMAIL missing; skipping email")
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

    def personalize(text, supporter)
      text.gsub("{first_name}", ERB::Util.html_escape(supporter.first_name.to_s))
          .gsub("{last_name}", ERB::Util.html_escape(supporter.last_name.to_s))
          .gsub("{village}", ERB::Util.html_escape(supporter.village&.name.to_s))
    end

    # Public preview method so controllers don't need .send for private methods
    def preview_html(body, supporter)
      blast_wrapper_html(personalize(body, supporter))
    end

    def welcome_html(supporter)
      name = ERB::Util.html_escape(supporter.first_name.presence || "Supporter")

      <<~HTML
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Thank You for Your Support</title>
          </head>
          <body style="margin: 0; padding: 0; background: #f3f5fb; color: #1f2937; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding: 28px 12px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 620px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden;">
                    <tr>
                      <td style="background: #1B3A6B; padding: 20px 24px;">
                        <p style="margin: 0; color: #bfdbfe; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase;">Josh &amp; Tina 2026</p>
                        <h1 style="margin: 6px 0 0 0; color: #ffffff; font-size: 24px; line-height: 1.2;">Si Yu'os Ma'&aring;se, #{name}!</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 24px;">
                        <p style="margin: 0 0 12px 0; font-size: 16px;">
                          Thank you for signing up to support <strong>Josh Tenorio &amp; Tina Mu&ntilde;a Barnes</strong> for Guam 2026.
                        </p>
                        <p style="margin: 0 0 16px 0; font-size: 15px; color: #4b5563;">
                          Together, we'll build a stronger Guam. We'll keep you updated on campaign events, motorcades, and important milestones.
                        </p>

                        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 0 18px 0;">
                          <tr>
                            <td style="border-radius: 10px; background: #1B3A6B;">
                              <a href="#{frontend_url}" target="_blank" style="display: inline-block; padding: 12px 18px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600;">
                                Visit Campaign Page
                              </a>
                            </td>
                          </tr>
                        </table>

                        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 0 0 14px 0;">
                        <p style="margin: 0; font-size: 12px; color: #6b7280;">
                          You're receiving this because you signed up at #{frontend_url} and opted in to email updates.
                          If you no longer wish to receive emails, please contact the campaign team.
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

    def blast_wrapper_html(content)
      <<~HTML
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background: #f3f5fb; color: #1f2937; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding: 28px 12px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 620px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden;">
                    <tr>
                      <td style="background: #1B3A6B; padding: 20px 24px;">
                        <p style="margin: 0; color: #bfdbfe; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase;">Josh &amp; Tina 2026</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 24px; font-size: 15px; line-height: 1.6;">
                        #{content}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 0 24px 20px 24px;">
                        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 0 0 14px 0;">
                        <p style="margin: 0; font-size: 12px; color: #6b7280;">
                          You're receiving this because you opted in to email updates from the Josh &amp; Tina 2026 campaign.
                          To unsubscribe, please contact the campaign team.
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
