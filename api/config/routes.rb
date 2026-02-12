Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      # Public
      get "dashboard", to: "dashboard#show"
      get "stats", to: "dashboard#stats"
      resources :villages, only: [ :index, :show ]
      resources :supporters, only: [ :create, :index ] do
        collection do
          get :check_duplicate
          get :export
        end
      end

      # Authenticated staff
      namespace :staff do
        resources :supporters, only: [ :create ]
      end

      # Leaderboard
      get "leaderboard", to: "leaderboard#index"

      # QR Codes
      resources :qr_codes, only: [ :show ] do
        member do
          get :info
        end
        collection do
          post :generate
        end
      end

      # Events
      resources :events, only: [ :index, :show, :create ] do
        member do
          post :check_in
          get :attendees
        end
      end
    end
  end

  root to: proc { [ 200, {}, [ "Campaign Tracker API v1.0" ] ] }
end
