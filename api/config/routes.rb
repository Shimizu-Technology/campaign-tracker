Rails.application.routes.draw do
  mount ActionCable.server => "/cable"
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      # Public
      get "session", to: "session#show"
      get "dashboard", to: "dashboard#show"
      get "stats", to: "dashboard#stats"
      resources :villages, only: [ :index, :show, :update ]
      resources :supporters, only: [ :create, :index, :show, :update ] do
        collection do
          get :check_duplicate
          get :export
        end
      end
      resources :users, only: [ :index, :create, :update ] do
        member do
          post :resend_invite
        end
      end
      resources :quotas, only: [ :index, :update ], param: :village_id
      resources :precincts, only: [ :index, :update ]

      # Authenticated staff
      namespace :staff do
        resources :supporters, only: [ :create ]
      end

      # War Room
      get "war_room", to: "war_room#index"

      # Poll Watcher
      get "poll_watcher", to: "poll_watcher#index"
      post "poll_watcher/report", to: "poll_watcher#report"
      get "poll_watcher/precinct/:id/history", to: "poll_watcher#history"
      get "poll_watcher/strike_list", to: "poll_watcher#strike_list"
      patch "poll_watcher/strike_list/:supporter_id/turnout", to: "poll_watcher#update_turnout"
      post "poll_watcher/strike_list/:supporter_id/contact_attempts", to: "poll_watcher#create_contact_attempt"

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

      # Form Scanner (OCR)
      post "scan", to: "scan#create"

      # SMS
      get "sms/status", to: "sms#status"
      post "sms/send", to: "sms#send_single"
      post "sms/blast", to: "sms#blast"
      post "sms/event_notify", to: "sms#event_notify"

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
