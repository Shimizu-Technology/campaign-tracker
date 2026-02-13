# Campaign Tracker Seed Data
# Source: GEC Precinct Breakdown as of January 25, 2026

require "digest"

puts "Seeding Campaign Tracker..."

# Campaign
campaign = Campaign.find_or_create_by!(name: "Josh & Tina 2026") do |c|
  c.election_year = 2026
  c.election_type = "primary"
  c.status = "active"
  c.candidate_names = "Josh Tenorio & Tina Muña Barnes"
  c.party = "Democratic"
  c.primary_color = "#1B3A6B"
  c.secondary_color = "#C41E3A"
end

puts "  Campaign: #{campaign.name}"

# Villages + Precincts (official GEC data, Jan 25, 2026)
VILLAGE_DATA = [
  {
    name: "Hagåtña", region: "Central", population: 943, registered_voters: 344,
    precincts: [ { number: "1", alpha_range: "A-Z", voters: 344, polling_site: "Guam Congress Building" } ]
  },
  {
    name: "Asan-Ma'ina", region: "Central", population: 2011, registered_voters: 859,
    precincts: [ { number: "2", alpha_range: "A-Z", voters: 859, polling_site: "Asan/Maina Community Center" } ]
  },
  {
    name: "Piti", region: "Central", population: 1585, registered_voters: 786,
    precincts: [ { number: "3", alpha_range: "A-Z", voters: 786, polling_site: "Jose L.G. Rios Middle School Cafeteria" } ]
  },
  {
    name: "Hågat", region: "South", population: 4515, registered_voters: 1945,
    precincts: [
      { number: "4", alpha_range: "A-L", voters: 1027, polling_site: "Oceanview Middle School Classrooms" },
      { number: "4A", alpha_range: "M-Z", voters: 918, polling_site: "Oceanview Middle School Classrooms" }
    ]
  },
  {
    name: "Sånta Rita-Sumai", region: "South", population: 6470, registered_voters: 1812,
    precincts: [
      { number: "5", alpha_range: "A-K", voters: 847, polling_site: "Harry S. Truman Elem. School" },
      { number: "5A", alpha_range: "L-Z", voters: 965, polling_site: "Harry S. Truman Elem. School" }
    ]
  },
  {
    name: "Humåtak", region: "South", population: 647, registered_voters: 428,
    precincts: [ { number: "6", alpha_range: "A-Z", voters: 428, polling_site: "Humåtak Mayor's Office" } ]
  },
  {
    name: "Malesso'", region: "South", population: 1604, registered_voters: 902,
    precincts: [ { number: "7", alpha_range: "A-Z", voters: 902, polling_site: "Merizo Martyrs Memorial Elem. School" } ]
  },
  {
    name: "Inalåhan", region: "South", population: 2317, registered_voters: 1389,
    precincts: [
      { number: "8", alpha_range: "A-Md", voters: 731, polling_site: "Inalahan Middle School" },
      { number: "8A", alpha_range: "Me-Z", voters: 658, polling_site: "Inalahan Middle School" }
    ]
  },
  {
    name: "Talo'fo'fo'", region: "South", population: 3550, registered_voters: 1636,
    precincts: [
      { number: "9", alpha_range: "A-M", voters: 893, polling_site: "Talofofo Elem. School" },
      { number: "9A", alpha_range: "N-Z", voters: 743, polling_site: "Talofofo Elem. School" }
    ]
  },
  {
    name: "Yona", region: "South", population: 6298, registered_voters: 2819,
    precincts: [
      { number: "10", alpha_range: "A-D", voters: 967, polling_site: "M.U. Lujan Elem. School" },
      { number: "10A", alpha_range: "E-Pd", voters: 905, polling_site: "M.U. Lujan Elem. School" },
      { number: "10B", alpha_range: "Pe-Z", voters: 947, polling_site: "M.U. Lujan Elem. School" }
    ]
  },
  {
    name: "Chalan Pago/Ordot", region: "Central", population: 7064, registered_voters: 2695,
    precincts: [
      { number: "11", alpha_range: "A-D", voters: 911, polling_site: "Chalan Pago-Ordot Multipurpose Shelter" },
      { number: "11A", alpha_range: "E-Pd", voters: 864, polling_site: "Chalan Pago-Ordot Multipurpose Shelter" },
      { number: "11B", alpha_range: "Pe-Z", voters: 920, polling_site: "Chalan Pago-Ordot Multipurpose Shelter" }
    ]
  },
  {
    name: "Sinajana", region: "Central", population: 2611, registered_voters: 1545,
    precincts: [
      { number: "12", alpha_range: "A-L", voters: 792, polling_site: "C.L. Taitano Elem. School" },
      { number: "12A", alpha_range: "M-Z", voters: 753, polling_site: "C.L. Taitano Elem. School" }
    ]
  },
  {
    name: "Agana Heights", region: "Central", population: 3673, registered_voters: 1482,
    precincts: [
      { number: "13", alpha_range: "A-L", voters: 772, polling_site: "Agana Heights Elem. School" },
      { number: "13A", alpha_range: "M-Z", voters: 710, polling_site: "Agana Heights Elem. School" }
    ]
  },
  {
    name: "Mongmong/Toto/Maite", region: "Central", population: 6380, registered_voters: 2091,
    precincts: [
      { number: "14", alpha_range: "A-I", voters: 1054, polling_site: "J.Q. San Miguel Elem. School" },
      { number: "14A", alpha_range: "J-Z", voters: 1037, polling_site: "J.Q. San Miguel Elem. School" }
    ]
  },
  {
    name: "Barrigada", region: "Central", population: 7956, registered_voters: 3694,
    precincts: [
      { number: "15", alpha_range: "A-Crt", voters: 900, polling_site: "P.C. Lujan Elem. School" },
      { number: "15A", alpha_range: "Cru-K", voters: 894, polling_site: "P.C. Lujan Elem. School" },
      { number: "15B", alpha_range: "L-P", voters: 926, polling_site: "P.C. Lujan Elem. School" },
      { number: "15C", alpha_range: "Q-Z", voters: 974, polling_site: "P.C. Lujan Elem. School" }
    ]
  },
  {
    name: "Mangilao", region: "Central", population: 13476, registered_voters: 4762,
    precincts: [
      { number: "16", alpha_range: "A-Cd", voters: 937, polling_site: "George Washington High School" },
      { number: "16A", alpha_range: "Ce-F", voters: 983, polling_site: "George Washington High School" },
      { number: "16B", alpha_range: "G-Mh", voters: 989, polling_site: "George Washington High School" },
      { number: "16C", alpha_range: "Mi-R", voters: 877, polling_site: "George Washington High School" },
      { number: "16D", alpha_range: "S-Z", voters: 976, polling_site: "George Washington High School" }
    ]
  },
  {
    name: "Tamuning", region: "North", population: 18489, registered_voters: 4935,
    precincts: [
      { number: "17", alpha_range: "A-Cn", voters: 989, polling_site: "JFK High School" },
      { number: "17A", alpha_range: "Co-H", voters: 975, polling_site: "JFK High School" },
      { number: "17B", alpha_range: "I-Mn", voters: 982, polling_site: "JFK High School" },
      { number: "17C", alpha_range: "Mo-Sal", voters: 991, polling_site: "JFK High School" },
      { number: "17D", alpha_range: "Sam-Z", voters: 998, polling_site: "JFK High School" }
    ]
  },
  {
    name: "Dededo", region: "North", population: 44908, registered_voters: 13099,
    precincts: [
      { number: "18", alpha_range: "A-Bar", voters: 1129, polling_site: "Wettengel Elem. School" },
      { number: "18A", alpha_range: "Bas-Caq", voters: 1129, polling_site: "Wettengel Elem. School" },
      { number: "18B", alpha_range: "Car-Cz", voters: 1114, polling_site: "Wettengel Elem. School" },
      { number: "18C", alpha_range: "D", voters: 884, polling_site: "Okkodo High School" },
      { number: "18D", alpha_range: "E-Gar", voters: 927, polling_site: "Okkodo High School" },
      { number: "18E", alpha_range: "Gas-Jd", voters: 909, polling_site: "Okkodo High School" },
      { number: "18F", alpha_range: "Je-L", voters: 900, polling_site: "Okkodo High School" },
      { number: "18G", alpha_range: "M-Mer", voters: 889, polling_site: "Liguan Elem. School" },
      { number: "18H", alpha_range: "Mes-O", voters: 895, polling_site: "Liguan Elem. School" },
      { number: "18I", alpha_range: "P-Quh", voters: 881, polling_site: "Liguan Elem. School" },
      { number: "18J", alpha_range: "Qui-Sal", voters: 1039, polling_site: "Liguan Elem. School" },
      { number: "18K", alpha_range: "Sam-Tak", voters: 1185, polling_site: "Liguan Elem. School" },
      { number: "18L", alpha_range: "Tal-Z", voters: 1218, polling_site: "Liguan Elem. School" }
    ]
  },
  {
    name: "Yigo", region: "North", population: 19339, registered_voters: 6405,
    precincts: [
      { number: "19", alpha_range: "A-Cak", voters: 1002, polling_site: "Dominican Catholic School Veritas Hall" },
      { number: "19A", alpha_range: "Cal-D", voters: 1059, polling_site: "Dominican Catholic School Veritas Hall" },
      { number: "19B", alpha_range: "E-K", voters: 1050, polling_site: "Dominican Catholic School Veritas Hall" },
      { number: "19C", alpha_range: "L-M", voters: 906, polling_site: "D.L. Perez Elem. School" },
      { number: "19D", alpha_range: "N-Q", voters: 785, polling_site: "D.L. Perez Elem. School" },
      { number: "19E", alpha_range: "R-Sn", voters: 807, polling_site: "D.L. Perez Elem. School" },
      { number: "19F", alpha_range: "So-Z", voters: 796, polling_site: "D.L. Perez Elem. School" }
    ]
  }
].freeze

total_villages = 0
total_precincts = 0

VILLAGE_DATA.each do |vdata|
  village = Village.find_or_create_by!(name: vdata[:name]) do |v|
    v.region = vdata[:region]
    v.population = vdata[:population]
    v.registered_voters = vdata[:registered_voters]
    v.precinct_count = vdata[:precincts].size
  end

  vdata[:precincts].each do |pdata|
    Precinct.find_or_create_by!(number: pdata[:number], village: village) do |p|
      p.alpha_range = pdata[:alpha_range]
      p.registered_voters = pdata[:voters]
      p.polling_site = pdata[:polling_site]
    end
    total_precincts += 1
  end

  # Create a default quota (proportional to 10K goal)
  target = (vdata[:registered_voters].to_f / 53628 * 10000).round
  Quota.find_or_create_by!(village: village, campaign: campaign, period: "quarterly") do |q|
    q.target_count = target
    q.target_date = Date.new(2026, 7, 31) # Before Aug 1 primary
  end

  total_villages += 1
end

puts "  #{total_villages} villages seeded"
puts "  #{total_precincts} precincts seeded"
puts "  #{Quota.count} quotas created"
puts "  Total registered voters: #{Village.sum(:registered_voters)}"

bootstrap_admin_emails = ENV.fetch("BOOTSTRAP_ADMIN_EMAILS", "")
  .split(",")
  .map { |email| email.strip.downcase }
  .reject(&:blank?)
bootstrap_role = ENV.fetch("BOOTSTRAP_ADMIN_ROLE", "campaign_admin")

if bootstrap_admin_emails.any?
  unless User::ROLES.include?(bootstrap_role)
    raise "Invalid BOOTSTRAP_ADMIN_ROLE=#{bootstrap_role.inspect}. Allowed: #{User::ROLES.join(', ')}"
  end

  bootstrap_admin_emails.each do |email|
    placeholder_clerk_id = "seed-#{Digest::SHA256.hexdigest(email).first(24)}"
    default_name = email.split("@").first.tr("._", " ").split.map(&:capitalize).join(" ")

    user = User.find_or_initialize_by(email: email)
    user.clerk_id = placeholder_clerk_id if user.clerk_id.blank?
    user.name = default_name if user.name.blank?
    user.role = bootstrap_role
    user.save!

    puts "  Bootstrap user: #{email} (#{bootstrap_role})"
  end
else
  puts "  No BOOTSTRAP_ADMIN_EMAILS configured; skipping bootstrap user seed"
end

puts "Done!"
