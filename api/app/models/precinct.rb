class Precinct < ApplicationRecord
  belongs_to :village
  has_many :supporters, dependent: :nullify
  has_many :poll_reports, dependent: :destroy

  validates :number, presence: true
end
