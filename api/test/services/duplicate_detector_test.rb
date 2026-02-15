require "test_helper"

class DuplicateDetectorTest < ActiveSupport::TestCase
  setup do
    @village1 = Village.first || Village.create!(name: "Test Village", region: "Central", registered_voters: 100)
    @village2 = Village.second || Village.create!(name: "Test Village 2", region: "South", registered_voters: 100)
    @base_attrs = { status: "active", verification_status: "unverified" }
  end

  test "find_duplicates detects normalized phone matches" do
    s1 = Supporter.create!(**@base_attrs, first_name: "A", last_name: "B", contact_number: "671-555-1234", village: @village1)
    s2 = Supporter.create!(**@base_attrs, first_name: "C", last_name: "D", contact_number: "+16715551234", village: @village2)

    assert_equal s1.normalized_phone, s2.normalized_phone
    assert_includes DuplicateDetector.find_duplicates(s2).pluck(:id), s1.id
    assert_includes DuplicateDetector.find_duplicates(s1).pluck(:id), s2.id
  end

  test "find_duplicates detects case-insensitive email matches" do
    s1 = Supporter.create!(**@base_attrs, first_name: "E", last_name: "F", contact_number: "671-111-0001", village: @village1, email: "test@example.com")
    s2 = Supporter.create!(**@base_attrs, first_name: "G", last_name: "H", contact_number: "671-111-0002", village: @village2, email: "TEST@Example.COM")

    assert_includes DuplicateDetector.find_duplicates(s2).pluck(:id), s1.id
  end

  test "find_duplicates detects name+village matches" do
    s1 = Supporter.create!(**@base_attrs, first_name: "Maria", last_name: "Cruz", contact_number: "671-222-0001", village: @village1)
    s2 = Supporter.create!(**@base_attrs, first_name: "Maria", last_name: "Cruz", contact_number: "671-222-0002", village: @village1)

    assert_includes DuplicateDetector.find_duplicates(s2).pluck(:id), s1.id
  end

  test "find_duplicates does not match different villages for name" do
    s1 = Supporter.create!(**@base_attrs, first_name: "Maria", last_name: "Cruz", contact_number: "671-333-0001", village: @village1)
    s2 = Supporter.create!(**@base_attrs, first_name: "Maria", last_name: "Cruz", contact_number: "671-333-0002", village: @village2)

    assert_not_includes DuplicateDetector.find_duplicates(s2).pluck(:id), s1.id
  end

  test "scan_all! finds duplicates in bulk using SQL" do
    s1 = Supporter.create!(**@base_attrs, first_name: "Scan", last_name: "Test1", contact_number: "671-444-0001", village: @village1)
    s2 = Supporter.create!(**@base_attrs, first_name: "Scan", last_name: "Test2", contact_number: "+16714440001", village: @village2)

    # Reset flags so scan_all! can find them fresh
    Supporter.where(id: [ s1.id, s2.id ]).update_all(potential_duplicate: false, duplicate_of_id: nil, duplicate_notes: nil)

    count = DuplicateDetector.scan_all!
    assert count > 0

    s2.reload
    assert s2.potential_duplicate?
    assert_equal s1.id, s2.duplicate_of_id
  end

  test "normalized_phone is set before save" do
    s = Supporter.create!(**@base_attrs, first_name: "Norm", last_name: "Phone", contact_number: "+1-671-555-9876", village: @village1)
    assert_equal "6715559876", s.normalized_phone
  end

  test "find_duplicates detects swapped name matches" do
    s1 = Supporter.create!(**@base_attrs, first_name: "Cruz", last_name: "Maria", contact_number: "671-555-0001", village: @village1)
    s2 = Supporter.create!(**@base_attrs, first_name: "Maria", last_name: "Cruz", contact_number: "671-555-0002", village: @village1)

    assert_includes DuplicateDetector.find_duplicates(s2).pluck(:id), s1.id
  end

  test "bidirectional flagging works for both supporters" do
    s1 = Supporter.create!(**@base_attrs, first_name: "Bi", last_name: "Dir1", contact_number: "671-666-0001", village: @village1)
    s2 = Supporter.create!(**@base_attrs, first_name: "Bi", last_name: "Dir2", contact_number: "+16716660001", village: @village2)

    # after_create triggers flag_if_duplicate!, so both should be flagged
    s1.reload
    s2.reload
    assert s2.potential_duplicate?, "Newer duplicate should be flagged"
    assert s1.potential_duplicate?, "Original should also be flagged"
  end

  test "normalized_phone handles empty and nil gracefully" do
    assert_nil Supporter.normalize_phone(nil)
    assert_nil Supporter.normalize_phone("")
    assert_equal "6715551234", Supporter.normalize_phone("671-555-1234")
    assert_equal "6715551234", Supporter.normalize_phone("+16715551234")
    assert_equal "6715551234", Supporter.normalize_phone("1-671-555-1234")
  end
end
