require "test_helper"

class SupporterTest < ActiveSupport::TestCase
  def setup
    @village_one = Village.create!(name: "Test Village One")
    @village_two = Village.create!(name: "Test Village Two")

    @precinct_one = Precinct.create!(number: "1", village: @village_one)
    @precinct_two = Precinct.create!(number: "2", village: @village_two)

    @block_one = Block.create!(name: "Block One", village: @village_one)
    @block_two = Block.create!(name: "Block Two", village: @village_two)
  end

  test "is valid when precinct and village match" do
    supporter = Supporter.new(
      first_name: "Valid", last_name: "Supporter", print_name: "Valid Supporter",
      contact_number: "6715551000",
      village: @village_one,
      precinct: @precinct_one,
      source: "staff_entry",
      status: "active"
    )

    assert supporter.valid?
  end

  test "is invalid when precinct belongs to different village" do
    supporter = Supporter.new(
      first_name: "Invalid", last_name: "Precinct Supporter", print_name: "Invalid Precinct Supporter",
      contact_number: "6715551001",
      village: @village_one,
      precinct: @precinct_two,
      source: "staff_entry",
      status: "active"
    )

    assert_not supporter.valid?
    assert_includes supporter.errors[:precinct_id], "must belong to the selected village"
  end

  test "is invalid when block belongs to different village" do
    supporter = Supporter.new(
      first_name: "Invalid", last_name: "Block Supporter", print_name: "Invalid Block Supporter",
      contact_number: "6715551002",
      village: @village_one,
      block: @block_two,
      source: "staff_entry",
      status: "active"
    )

    assert_not supporter.valid?
    assert_includes supporter.errors[:block_id], "must belong to the selected village"
  end

  test "is valid when block and village match" do
    supporter = Supporter.new(
      first_name: "Valid", last_name: "Block Supporter", print_name: "Valid Block Supporter",
      contact_number: "6715551003",
      village: @village_one,
      block: @block_one,
      source: "staff_entry",
      status: "active"
    )

    assert supporter.valid?
  end

  test "allows blank phone for staff/manual attribution" do
    supporter = Supporter.new(
      first_name: "NoPhone",
      last_name: "Manual",
      village: @village_one,
      source: "staff_entry",
      attribution_method: "staff_manual",
      turnout_status: "unknown",
      verification_status: "unverified",
      status: "active"
    )

    assert supporter.valid?
  end

  test "requires phone for public signup attribution" do
    supporter = Supporter.new(
      first_name: "NoPhone",
      last_name: "Public",
      village: @village_one,
      source: "qr_signup",
      attribution_method: "public_signup",
      turnout_status: "unknown",
      verification_status: "unverified",
      status: "active"
    )

    assert_not supporter.valid?
    assert_includes supporter.errors[:contact_number], "can't be blank"
  end
end
