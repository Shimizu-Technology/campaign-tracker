class HouseholdGroup < ApplicationRecord
  belongs_to :village, optional: true

  has_many :supporters, dependent: :nullify
end
