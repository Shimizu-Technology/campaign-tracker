# frozen_string_literal: true

class DuplicateDetector
  # Finds potential duplicates for a given supporter.
  # Checks: exact phone match, exact email match, fuzzy name + same village.
  # Returns an array of matching supporter records (excludes self).
  def self.find_duplicates(supporter)
    return Supporter.none if supporter.nil?

    matches = Set.new

    # 1. Exact phone match (most reliable)
    if supporter.contact_number.present?
      normalized = normalize_phone(supporter.contact_number)
      Supporter.where.not(id: supporter.id)
               .where(contact_number: [ supporter.contact_number, normalized ].uniq)
               .pluck(:id)
               .each { |id| matches << id }

      # Also check normalized versions in DB
      Supporter.where.not(id: supporter.id)
               .where.not(contact_number: nil)
               .pluck(:id, :contact_number)
               .each do |(id, phone)|
        matches << id if normalize_phone(phone) == normalized
      end
    end

    # 2. Exact email match
    if supporter.email.present?
      Supporter.where.not(id: supporter.id)
               .where("LOWER(email) = ?", supporter.email.downcase.strip)
               .pluck(:id)
               .each { |id| matches << id }
    end

    # 3. Fuzzy name match within same village
    if supporter.first_name.present? && supporter.last_name.present? && supporter.village_id.present?
      fn = supporter.first_name.downcase.strip
      ln = supporter.last_name.downcase.strip

      Supporter.where.not(id: supporter.id)
               .where(village_id: supporter.village_id)
               .where("LOWER(first_name) = ? AND LOWER(last_name) = ?", fn, ln)
               .pluck(:id)
               .each { |id| matches << id }

      # Also check swapped name (First entered as Last, etc.)
      Supporter.where.not(id: supporter.id)
               .where(village_id: supporter.village_id)
               .where("LOWER(first_name) = ? AND LOWER(last_name) = ?", ln, fn)
               .pluck(:id)
               .each { |id| matches << id }
    end

    Supporter.where(id: matches.to_a)
  end

  # Flag a supporter as potential duplicate and record which supporter it matches.
  # Does NOT block creation — just flags for staff review.
  def self.flag_if_duplicate!(supporter)
    duplicates = find_duplicates(supporter)
    return if duplicates.empty?

    # Link to the oldest matching supporter (the "original")
    original = duplicates.order(:created_at).first

    supporter.update_columns(
      potential_duplicate: true,
      duplicate_of_id: original.id,
      duplicate_notes: build_notes(supporter, duplicates)
    )

    # Also flag the original if not already flagged, with back-reference
    unless original.potential_duplicate?
      original.update_columns(
        potential_duplicate: true,
        duplicate_of_id: supporter.id,
        duplicate_notes: "Has #{duplicates.count} potential duplicate(s) — newest: ##{supporter.id}"
      )
    end
  end

  # Resolve a duplicate: mark as reviewed, optionally merge into another record.
  def self.resolve!(supporter, action:, merge_into: nil, resolved_by: nil)
    case action
    when "dismiss"
      supporter.update!(
        potential_duplicate: false,
        duplicate_of_id: nil,
        duplicate_checked_at: Time.current,
        duplicate_notes: "Dismissed — not a duplicate"
      )
    when "merge"
      raise ArgumentError, "merge_into required for merge action" unless merge_into

      merge_supporters!(supporter, into: merge_into)
      supporter.update!(
        status: "duplicate",
        potential_duplicate: false,
        duplicate_checked_at: Time.current,
        duplicate_notes: "Merged into supporter ##{merge_into.id}"
      )
    end
  end

  # Scan all supporters for duplicates (background task).
  def self.scan_all!
    count = 0
    Supporter.active.find_each do |supporter|
      duplicates = find_duplicates(supporter)
      next if duplicates.empty?

      unless supporter.potential_duplicate?
        original = duplicates.order(:created_at).first
        supporter.update_columns(
          potential_duplicate: true,
          duplicate_of_id: original&.id,
          duplicate_notes: build_notes(supporter, duplicates)
        )
        count += 1
      end
    end
    count
  end

  private_class_method def self.normalize_phone(phone)
    return nil if phone.blank?
    digits = phone.gsub(/\D/, "")
    # Handle Guam numbers: strip leading 1 or +1671
    digits = digits.sub(/\A1?671/, "671") if digits.length >= 10
    digits
  end

  private_class_method def self.build_notes(supporter, duplicates)
    reasons = []
    duplicates.each do |dup|
      matching = []
      matching << "phone" if normalize_phone(dup.contact_number) == normalize_phone(supporter.contact_number)
      matching << "email" if dup.email.present? && supporter.email.present? && dup.email.downcase == supporter.email.downcase
      matching << "name+village" if dup.first_name&.downcase == supporter.first_name&.downcase &&
                                     dup.last_name&.downcase == supporter.last_name&.downcase &&
                                     dup.village_id == supporter.village_id
      reasons << "##{dup.id} (#{matching.join(', ')})"
    end
    "Matches: #{reasons.join('; ')}"
  end

  private_class_method def self.merge_supporters!(source, into:)
    # Transfer event RSVPs — preserve attended=true if either record attended
    source.event_rsvps.each do |rsvp|
      existing = into.event_rsvps.find_by(event_id: rsvp.event_id)
      if existing
        existing.update!(attended: true) if rsvp.attended && !existing.attended
      else
        rsvp.update!(supporter_id: into.id)
      end
    end

    # Transfer contact attempts
    source.supporter_contact_attempts.update_all(supporter_id: into.id)

    # Merge fields: keep into's values, fill unset (nil) from source
    # Use nil? instead of blank? so false booleans aren't overwritten
    mergeable = %w[email registered_voter motorcade_available yard_sign opt_in_email opt_in_text]
    mergeable.each do |field|
      into_val = into.send(field)
      source_val = source.send(field)
      if into_val.nil? && !source_val.nil?
        into.send("#{field}=", source_val)
      end
    end
    into.save! if into.changed?
  end
end
