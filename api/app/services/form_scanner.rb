# frozen_string_literal: true

require "net/http"
require "uri"
require "json"
require "base64"

# Extracts supporter data from photographed campaign signup forms
# using Gemini 2.5 Flash via OpenRouter.
class FormScanner
  OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
  MODEL = "google/gemini-2.5-flash"

  EXTRACTION_PROMPT = <<~PROMPT
    You are extracting data from a Guam political campaign supporter signup form.
    The form is a physical paper form that has been photographed.
    Fields may be handwritten or printed. Extract what you can read.

    Extract these fields (return null for any field you cannot read):
    - print_name: Full printed name
    - contact_number: Phone number (Guam numbers are typically 671-XXX-XXXX)
    - email: Email address
    - street_address: Street/home address
    - dob: Date of birth (format as YYYY-MM-DD if possible)
    - village: Village name (one of Guam's 19 villages)
    - precinct_number: Precinct number if visible
    - registered_voter: true/false (look for checkmark or Y/N)
    - yard_sign: true/false (wants a yard sign)
    - motorcade_available: true/false (available for motorcade)

    Guam's 19 villages: Agana Heights, Asan-Ma'ina, Barrigada, Chalan Pago/Ordot,
    Dededo, Hågat, Hagåtña, Humåtak, Inalåhan, Malesso', Mangilao,
    Mongmong/Toto/Maite, Piti, Sånta Rita-Sumai, Sinajana, Talo'fo'fo',
    Tamuning, Yigo, Yona.

    Return ONLY valid JSON with these exact keys. No markdown, no explanation.
    For boolean fields, use true/false. For unknown fields, use null.
    If you see multiple forms, extract only the first/most prominent one.

    Example response:
    {"print_name":"Juan Cruz","contact_number":"671-555-1234","email":null,"street_address":"123 Marine Corps Dr","dob":"1985-03-15","village":"Tamuning","precinct_number":"17","registered_voter":true,"yard_sign":false,"motorcade_available":true}
  PROMPT

  class << self
    def extract(image_data)
      api_key = ENV["OPENROUTER_API_KEY"]
      if api_key.blank?
        return { success: false, error: "OpenRouter API key not configured" }
      end

      # Handle both base64 data and data URLs
      if image_data.start_with?("data:")
        image_url = image_data
      else
        # Assume base64 JPEG if no prefix
        image_url = "data:image/jpeg;base64,#{image_data}"
      end

      payload = {
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: EXTRACTION_PROMPT },
              { type: "image_url", image_url: { url: image_url } }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      }

      uri = URI(OPENROUTER_URL)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = true
      http.open_timeout = 15
      http.read_timeout = 30

      request = Net::HTTP::Post.new(uri.request_uri, {
        "Authorization" => "Bearer #{api_key}",
        "Content-Type" => "application/json",
        "HTTP-Referer" => "https://campaign-tracker.shimizu-technology.com",
        "X-Title" => "Campaign Tracker OCR"
      })
      request.body = payload.to_json

      Rails.logger.info("[FormScanner] Sending image to Gemini 2.5 Flash via OpenRouter")

      begin
        response = http.request(request)
      rescue StandardError => e
        Rails.logger.error("[FormScanner] HTTP error: #{e.message}")
        return { success: false, error: e.message }
      end

      if response.code.to_i == 200
        json = JSON.parse(response.body) rescue {}
        content = json.dig("choices", 0, "message", "content")

        if content.present?
          # Parse the JSON from the response (strip any markdown fencing)
          clean = content.strip.gsub(/\A```json\s*/, "").gsub(/\s*```\z/, "")
          begin
            extracted = JSON.parse(clean)
            Rails.logger.info("[FormScanner] Extracted: #{extracted['print_name']} from #{extracted['village']}")

            # Normalize village name to match our DB
            extracted["village_id"] = match_village(extracted["village"]) if extracted["village"]

            { success: true, data: extracted, raw_response: content }
          rescue JSON::ParserError => e
            Rails.logger.error("[FormScanner] JSON parse error: #{e.message}, raw: #{content}")
            { success: false, error: "Could not parse extracted data", raw_response: content }
          end
        else
          Rails.logger.error("[FormScanner] Empty response from API")
          { success: false, error: "No data extracted from image" }
        end
      else
        error_body = JSON.parse(response.body) rescue { "error" => response.body }
        Rails.logger.error("[FormScanner] API error #{response.code}: #{error_body}")
        { success: false, error: "API error: #{response.code}", details: error_body }
      end
    end

    private

    def match_village(name)
      return nil if name.blank?

      # Try exact match first, then fuzzy
      village = Village.find_by("LOWER(name) = ?", name.downcase.strip)
      return village.id if village

      # Try partial match
      village = Village.where("LOWER(name) LIKE ?", "%#{name.downcase.strip}%").first
      village&.id
    end
  end
end
