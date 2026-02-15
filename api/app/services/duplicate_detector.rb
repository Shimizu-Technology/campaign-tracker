# frozen_string_literal: true

class DuplicateDetector
  # Finds potential duplicates for a given supporter using indexed SQL queries.
  # Checks: normalized phone match, exact email match, name + village match.
  # Returns an ActiveRecord relation of matching supporters (excludes self).
  def self.find_duplicates(supporter)
    return Supporter.none if supporter.nil?

    match_ids = Set.new

    # 1. Normalized phone match (uses index on normalized_phone)
    if supporter.normalized_phone.present?
      Supporter.where.not(id: supporter.id)
               .where(normalized_phone: supporter.normalized_phone)
               .pluck(:id)
               .each { |id| match_ids << id }
    end

    # 2. Case-insensitive email match (uses index on email)
    if supporter.email.present?
      Supporter.where.not(id: supporter.id)
               .where("LOWER(email) = LOWER(?)", supporter.email.strip)
               .pluck(:id)
               .each { |id| match_ids << id }
    end

    # 3. Name + village match (uses composite index)
    if supporter.first_name.present? && supporter.last_name.present? && supporter.village_id.present?
      fn = supporter.first_name.downcase.strip
      ln = supporter.last_name.downcase.strip

      # Exact name match in same village
      Supporter.where.not(id: supporter.id)
               .where(village_id: supporter.village_id)
               .where("LOWER(TRIM(first_name)) = ? AND LOWER(TRIM(last_name)) = ?", fn, ln)
               .pluck(:id)
               .each { |id| match_ids << id }

      # Swapped name match (First <-> Last) in same village
      Supporter.where.not(id: supporter.id)
               .where(village_id: supporter.village_id)
               .where("LOWER(TRIM(first_name)) = ? AND LOWER(TRIM(last_name)) = ?", ln, fn)
               .pluck(:id)
               .each { |id| match_ids << id }
    end

    Supporter.where(id: match_ids.to_a)
  end

  # Flag a supporter as potential duplicate and record which supporter it matches.
  def self.flag_if_duplicate!(supporter)
    duplicates = find_duplicates(supporter)
    return if duplicates.empty?

    original = duplicates.order(:created_at).first

    supporter.update_columns(
      potential_duplicate: true,
      duplicate_of_id: original.id,
      duplicate_notes: build_notes(supporter, duplicates)
    )

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

  # Scan all supporters for duplicates using bulk SQL queries.
  # Returns the number of newly flagged duplicates.
  def self.scan_all!
    # Reset previous flags before re-scanning
    # (keeps dismissed ones — only resets auto-flagged)

    count = 0

    # Phase 1: Find phone duplicates in bulk via SQL
    phone_dupes = ActiveRecord::Base.connection.execute(<<-SQL)
      SELECT s1.id AS supporter_id, MIN(s2.id) AS match_id, 'phone' AS match_type
      FROM supporters s1
      JOIN supporters s2
        ON s1.normalized_phone = s2.normalized_phone
        AND s1.id > s2.id
        AND s1.normalized_phone IS NOT NULL
        AND s1.normalized_phone != ''
      WHERE s1.status = 'active'
        AND s2.status = 'active'
      GROUP BY s1.id
    SQL

    # Phase 2: Find email duplicates in bulk via SQL
    email_dupes = ActiveRecord::Base.connection.execute(<<-SQL)
      SELECT s1.id AS supporter_id, MIN(s2.id) AS match_id, 'email' AS match_type
      FROM supporters s1
      JOIN supporters s2
        ON LOWER(s1.email) = LOWER(s2.email)
        AND s1.id > s2.id
        AND s1.email IS NOT NULL
        AND s1.email != ''
      WHERE s1.status = 'active'
        AND s2.status = 'active'
      GROUP BY s1.id
    SQL

    # Phase 3: Find name+village duplicates in bulk via SQL
    name_dupes = ActiveRecord::Base.connection.execute(<<-SQL)
      SELECT s1.id AS supporter_id, MIN(s2.id) AS match_id, 'name+village' AS match_type
      FROM supporters s1
      JOIN supporters s2
        ON s1.village_id = s2.village_id
        AND LOWER(TRIM(s1.first_name)) = LOWER(TRIM(s2.first_name))
        AND LOWER(TRIM(s1.last_name)) = LOWER(TRIM(s2.last_name))
        AND s1.id > s2.id
      WHERE s1.status = 'active'
        AND s2.status = 'active'
        AND s1.first_name IS NOT NULL
        AND s1.last_name IS NOT NULL
      GROUP BY s1.id
    SQL

    # Phase 4: Also check swapped names
    swapped_dupes = ActiveRecord::Base.connection.execute(<<-SQL)
      SELECT s1.id AS supporter_id, MIN(s2.id) AS match_id, 'name+village' AS match_type
      FROM supporters s1
      JOIN supporters s2
        ON s1.village_id = s2.village_id
        AND LOWER(TRIM(s1.first_name)) = LOWER(TRIM(s2.last_name))
        AND LOWER(TRIM(s1.last_name)) = LOWER(TRIM(s2.first_name))
        AND s1.id > s2.id
      WHERE s1.status = 'active'
        AND s2.status = 'active'
        AND s1.first_name IS NOT NULL
        AND s1.last_name IS NOT NULL
      GROUP BY s1.id
    SQL

    # Merge all results: supporter_id -> { match_id, match_types }
    all_dupes = {}
    [phone_dupes, email_dupes, name_dupes, swapped_dupes].each do |result_set|
      result_set.each do |row|
        sid = row["supporter_id"]
        mid = row["match_id"]
        mtype = row["match_type"]
        all_dupes[sid] ||= { match_id: mid, match_types: [] }
        all_dupes[sid][:match_types] << mtype
        # Keep the oldest match
        all_dupes[sid][:match_id] = [all_dupes[sid][:match_id], mid].min
      end
    end

    # Bulk update all flagged supporters
    all_dupes.each do |supporter_id, info|
      match_types = info[:match_types].uniq.join(", ")
      notes = "Matches: ##{info[:match_id]} (#{match_types})"

      Supporter.where(id: supporter_id)
               .where(potential_duplicate: false)
               .update_all(
                 potential_duplicate: true,
                 duplicate_of_id: info[:match_id],
                 duplicate_notes: notes
               )
      count += 1

      # Also flag the match target
      Supporter.where(id: info[:match_id])
               .where(potential_duplicate: false)
               .update_all(
                 potential_duplicate: true,
                 duplicate_of_id: supporter_id,
                 duplicate_notes: "Has potential duplicate(s) — see ##{supporter_id}"
               )
    end

    count
  end

  private_class_method def self.build_notes(supporter, duplicates)
    reasons = []
    duplicates.each do |dup|
      matching = []
      matching << "phone" if dup.normalized_phone.present? && dup.normalized_phone == supporter.normalized_phone
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
