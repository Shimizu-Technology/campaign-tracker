Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      # Public
      get "dashboard", to: "dashboard#show"
      resources :villages, only: [ :index, :show ]
      resources :supporters, only: [ :create, :index ] do
        collection do
          get :check_duplicate
        end
      end

      # Authenticated staff
      namespace :staff do
        resources :supporters, only: [ :create ]
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
