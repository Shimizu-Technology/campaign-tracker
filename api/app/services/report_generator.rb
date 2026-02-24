# frozen_string_literal: true

# Generates Excel reports for the campaign data team.
# All reports export to .xlsx format with styled headers.
#
# Report types:
#   - support_list:  Vetted supporters by village
#   - purge_list:    Voters removed from GEC list (deceased/purged)
#   - transfer_list: Voters who changed villages between GEC list versions
#   - referral_list: Supporters submitted under wrong village
#   - quota_summary: Totals by village with progress toward target
class ReportGenerator
  REPORT_TYPES = %w[support_list purge_list transfer_list referral_list quota_summary].freeze

  def initialize(report_type:, village_id: nil, campaign_id: nil)
    @report_type = report_type
    @village_id = village_id
    @campaign_id = campaign_id
  end

  def generate
    raise ArgumentError, "Unknown report type: #{@report_type}" unless REPORT_TYPES.include?(@report_type)

    send("generate_#{@report_type}")
  end

  private

  def header_style(workbook)
    workbook.styles.add_style(
      b: true,
      bg_color: "1B3A6B",
      fg_color: "FFFFFF",
      alignment: { horizontal: :center },
      border: { style: :thin, color: "000000" }
    )
  end

  def date_today
    Date.current.strftime("%m-%d-%Y")
  end

  # Build a lookup hash of GEC voters keyed by [lowercase_first, lowercase_last, dob]
  # to avoid N+1 queries in support list generation.
  def build_gec_lookup(supporters)
    return {} if supporters.empty?

    # Collect unique name+dob combos
    keys = supporters.filter_map do |s|
      next unless s.first_name.present? && s.last_name.present? && s.dob.present?
      [ s.first_name.downcase.strip, s.last_name.downcase.strip, s.dob ]
    end.uniq

    return {} if keys.empty?

    # Batch query
    lookup = {}
    GecVoter.active.find_each do |gv|
      key = [ gv.first_name.downcase.strip, gv.last_name.downcase.strip, gv.dob ]
      lookup[key] ||= gv
    end
    lookup
  end

  def lookup_gec_voter(gec_lookup, supporter)
    return nil unless supporter.first_name.present? && supporter.last_name.present? && supporter.dob.present?
    gec_lookup[[ supporter.first_name.downcase.strip, supporter.last_name.downcase.strip, supporter.dob ]]
  end

  # ── Support List ──────────────────────────────────────────────
  # All vetted (verified) supporters, grouped by village
  def generate_support_list
    scope = Supporter.active.quota_eligible.includes(:village, :precinct, :entered_by)
    scope = scope.where(village_id: @village_id) if @village_id.present?
    scope = scope.order("villages.name", :last_name, :first_name)

    all_supporters = scope.to_a
    gec_lookup = build_gec_lookup(all_supporters)

    package = Axlsx::Package.new
    wb = package.workbook
    headers = [ "Last Name", "First Name", "DOB", "Phone", "Street Address",
                "Village", "Precinct", "Voter Reg #", "Date Submitted",
                "Submitted By", "Verification Status" ]

    if @village_id.present?
      village = Village.find(@village_id)
      add_support_sheet(wb, village.name, headers, all_supporters, gec_lookup)
    else
      grouped = all_supporters.group_by { |s| s.village&.name || "Unknown" }
      grouped.sort_by { |name, _| name }.each do |village_name, supporters|
        add_support_sheet(wb, village_name, headers, supporters, gec_lookup)
      end
    end

    { package: package, filename: "support-list-#{date_today}.xlsx" }
  end

  def add_support_sheet(workbook, sheet_name, headers, supporters, gec_lookup)
    safe_name = sheet_name.to_s[0..30]
    workbook.add_worksheet(name: safe_name) do |sheet|
      sheet.add_row headers, style: header_style(workbook)
      supporters.each do |s|
        gec_match = lookup_gec_voter(gec_lookup, s)
        sheet.add_row [
          s.last_name, s.first_name, s.dob&.strftime("%m/%d/%Y"),
          s.contact_number, s.street_address,
          s.village&.name, s.precinct&.number,
          gec_match&.voter_registration_number,
          s.created_at&.strftime("%m/%d/%Y"),
          s.entered_by&.name || "System",
          s.verification_status&.humanize
        ]
      end
      sheet.column_widths 15, 15, 12, 15, 25, 15, 10, 15, 12, 15, 15
    end
  end

  # ── Purge List ────────────────────────────────────────────────
  # GEC voters who were on the previous list but not on the current one
  def generate_purge_list
    current_date = GecVoter.maximum(:gec_list_date)
    return empty_report("purge-list", "No GEC data available") unless current_date

    purged = GecVoter.where(status: "removed")
    purged = purged.left_joins(:village).where(village_id: @village_id) if @village_id.present?
    purged = purged.order(:village_name, :last_name, :first_name)

    package = Axlsx::Package.new
    wb = package.workbook
    headers = [ "Last Name", "First Name", "DOB", "Village", "Voter Reg #",
                "Reason", "Last GEC List Date" ]

    wb.add_worksheet(name: "Purge List") do |sheet|
      sheet.add_row headers, style: header_style(wb)
      purged.each do |gv|
        sheet.add_row [
          gv.last_name, gv.first_name, gv.dob&.strftime("%m/%d/%Y"),
          gv.village_name, gv.voter_registration_number,
          "Removed from GEC list",
          gv.gec_list_date&.strftime("%m/%d/%Y")
        ]
      end
      sheet.column_widths 15, 15, 12, 15, 15, 25, 15
    end

    { package: package, filename: "purge-list-#{date_today}.xlsx" }
  end

  # ── Transfer List ─────────────────────────────────────────────
  # Supporters whose GEC village doesn't match their submission village
  def generate_transfer_list
    scope = Supporter.active.where.not(referred_from_village_id: nil)
      .includes(:village, :entered_by)
    scope = scope.where(village_id: @village_id) if @village_id.present?
    scope = scope.order(:last_name, :first_name)

    # Pre-load referred villages to avoid N+1
    referred_village_ids = scope.pluck(:referred_from_village_id).compact.uniq
    village_lookup = Village.where(id: referred_village_ids).index_by(&:id)

    package = Axlsx::Package.new
    wb = package.workbook
    headers = [ "Last Name", "First Name", "DOB", "Phone",
                "Submitted Village", "Actual Village (GEC)",
                "Date Detected", "Explanation" ]

    wb.add_worksheet(name: "Transfer List") do |sheet|
      sheet.add_row headers, style: header_style(wb)
      scope.each do |s|
        actual_village = village_lookup[s.referred_from_village_id]
        sheet.add_row [
          s.last_name, s.first_name, s.dob&.strftime("%m/%d/%Y"),
          s.contact_number,
          s.village&.name,
          actual_village&.name || "Unknown",
          s.updated_at&.strftime("%m/%d/%Y"),
          "Registered in #{actual_village&.name || 'another village'} per GEC, submitted under #{s.village&.name}"
        ]
      end
      sheet.column_widths 15, 15, 12, 15, 18, 18, 12, 45
    end

    { package: package, filename: "transfer-list-#{date_today}.xlsx" }
  end

  # ── Referral List ─────────────────────────────────────────────
  # Same as transfer but from the receiving village's perspective
  def generate_referral_list
    scope = Supporter.active.where.not(referred_from_village_id: nil)
      .includes(:village, :entered_by)
    scope = scope.where(referred_from_village_id: @village_id) if @village_id.present?
    scope = scope.order(:last_name, :first_name)

    # Pre-load referred villages
    referred_village_ids = scope.pluck(:referred_from_village_id).compact.uniq
    village_lookup = Village.where(id: referred_village_ids).index_by(&:id)

    package = Axlsx::Package.new
    wb = package.workbook
    headers = [ "Last Name", "First Name", "DOB", "Phone",
                "Submitted Under", "Actual Village (GEC)",
                "Submitted By", "Date" ]

    wb.add_worksheet(name: "Referral List") do |sheet|
      sheet.add_row headers, style: header_style(wb)
      scope.each do |s|
        actual_village = village_lookup[s.referred_from_village_id]
        sheet.add_row [
          s.last_name, s.first_name, s.dob&.strftime("%m/%d/%Y"),
          s.contact_number,
          s.village&.name,
          actual_village&.name || "Unknown",
          s.entered_by&.name || "System",
          s.created_at&.strftime("%m/%d/%Y")
        ]
      end
      sheet.column_widths 15, 15, 12, 15, 18, 18, 15, 12
    end

    { package: package, filename: "referral-list-#{date_today}.xlsx" }
  end

  # ── Quota Summary ─────────────────────────────────────────────
  # Per-village totals: quota target, verified count, progress
  def generate_quota_summary
    villages = Village.includes(:precincts).order(:name)
    villages = villages.where(id: @village_id) if @village_id.present?

    campaign = @campaign_id ? Campaign.find(@campaign_id) : Campaign.active.first
    village_ids = villages.pluck(:id)

    package = Axlsx::Package.new
    wb = package.workbook
    headers = [ "Village", "Quota Target", "Quota Eligible (Verified Team Input)",
                "Total Verified", "Total Active", "Public Signups",
                "Unregistered", "Progress %", "Status" ]

    wb.add_worksheet(name: "Quota Summary") do |sheet|
      sheet.add_row headers, style: header_style(wb)

      grand_target = 0
      grand_eligible = 0
      grand_verified = 0
      grand_total = 0
      grand_public = 0
      grand_unregistered = 0

      villages.each do |v|
        target = campaign ? Quota.where(campaign_id: campaign.id, village_id: v.id).sum(:target_count) : 0
        quota_eligible = Supporter.active.quota_eligible.where(village_id: v.id).count
        verified = Supporter.active.verified.where(village_id: v.id).count
        total = Supporter.active.where(village_id: v.id).count
        public_count = Supporter.active.public_signups.where(village_id: v.id).count
        unregistered = Supporter.active.where(village_id: v.id, registered_voter: false).count
        pct = target.positive? ? (quota_eligible * 100.0 / target).round(1) : 0
        status = pct >= 100 ? "Complete" : pct >= 75 ? "On Track" : pct >= 50 ? "Behind" : "Critical"

        grand_target += target
        grand_eligible += quota_eligible
        grand_verified += verified
        grand_total += total
        grand_public += public_count
        grand_unregistered += unregistered

        sheet.add_row [ v.name, target, quota_eligible, verified, total,
                        public_count, unregistered, pct, status ]
      end

      # Grand total row — uses accumulated values (respects village_id filter)
      grand_pct = grand_target.positive? ? (grand_eligible * 100.0 / grand_target).round(1) : 0
      total_style = wb.styles.add_style(b: true, border: { style: :thin, color: "000000" })
      sheet.add_row [ "TOTAL", grand_target, grand_eligible,
                      grand_verified, grand_total, grand_public, grand_unregistered,
                      grand_pct,
                      grand_pct >= 100 ? "Complete" : "In Progress" ],
                    style: total_style

      sheet.column_widths 18, 14, 28, 14, 14, 14, 14, 12, 12
    end

    { package: package, filename: "quota-summary-#{date_today}.xlsx" }
  end

  # ── Helpers ───────────────────────────────────────────────────

  def empty_report(name, message)
    package = Axlsx::Package.new
    wb = package.workbook
    wb.add_worksheet(name: "Info") do |sheet|
      sheet.add_row [ message ]
    end
    { package: package, filename: "#{name}-#{date_today}.xlsx" }
  end
end
