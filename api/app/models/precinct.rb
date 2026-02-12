class Precinct < ApplicationRecord
  belongs_to :village
  has_many :supporters, dependent: :nullify

  validates :number, presence: true
end
