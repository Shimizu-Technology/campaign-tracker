class ApplicationController < ActionController::API
  private

  def render_api_error(message:, status:, code:, details: nil)
    payload = {
      error: message,
      code: code
    }
    payload[:details] = details if details.present?

    render json: payload, status: status
  end
end
