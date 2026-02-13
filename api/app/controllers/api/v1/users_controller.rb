# frozen_string_literal: true

module Api
  module V1
    class UsersController < ApplicationController
      include Authenticatable
      before_action :authenticate_request
      before_action :require_admin!

      # GET /api/v1/users
      def index
        users = User.order(:name)
        render json: users.map { |u|
          {
            id: u.id,
            clerk_id: u.clerk_id,
            email: u.email,
            name: u.name,
            role: u.role,
            created_at: u.created_at
          }
        }
      end

      # PATCH /api/v1/users/:id
      def update
        user = User.find(params[:id])
        if user.update(user_params)
          render json: { id: user.id, email: user.email, name: user.name, role: user.role }
        else
          render json: { errors: user.errors.full_messages }, status: :unprocessable_entity
        end
      end

      private

      def user_params
        params.permit(:role, :name)
      end
    end
  end
end
