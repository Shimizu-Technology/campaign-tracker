# frozen_string_literal: true

class PollReport < ApplicationRecord
  belongs_to :precinct
  belongs_to :user, optional: true

  validates :voter_count, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :report_type, presence: true, inclusion: { in: %w[turnout_update issue line_length closing] }
  validates :reported_at, presence: true

  scope :today, -> { where("reported_at >= ?", Date.current.beginning_of_day) }
  scope :chronological, -> { order(reported_at: :desc) }

  # Get the latest report for each precinct
  def self.latest_per_precinct
    select("DISTINCT ON (precinct_id) *")
      .order(:precinct_id, reported_at: :desc)
  end
end
