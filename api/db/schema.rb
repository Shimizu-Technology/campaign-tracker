# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_02_12_214132) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "blocks", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "leader_id"
    t.string "name"
    t.datetime "updated_at", null: false
    t.bigint "village_id", null: false
    t.index ["village_id"], name: "index_blocks_on_village_id"
  end

  create_table "campaigns", force: :cascade do |t|
    t.string "candidate_names"
    t.datetime "created_at", null: false
    t.string "election_type"
    t.integer "election_year"
    t.string "logo_url"
    t.string "name"
    t.string "party"
    t.string "primary_color"
    t.string "secondary_color"
    t.string "status"
    t.datetime "updated_at", null: false
    t.index ["status"], name: "index_campaigns_on_status"
  end

  create_table "companies", force: :cascade do |t|
    t.boolean "active", default: true
    t.string "address_line1"
    t.string "address_line2"
    t.string "city"
    t.datetime "created_at", null: false
    t.string "ein"
    t.string "email"
    t.string "name", null: false
    t.string "pay_frequency", default: "biweekly"
    t.string "phone"
    t.string "state"
    t.datetime "updated_at", null: false
    t.string "zip"
    t.index ["ein"], name: "index_companies_on_ein", unique: true
    t.index ["name"], name: "index_companies_on_name"
  end

  create_table "company_ytd_totals", force: :cascade do |t|
    t.integer "active_employees", default: 0
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.decimal "employer_medicare", precision: 16, scale: 2, default: "0.0"
    t.decimal "employer_social_security", precision: 16, scale: 2, default: "0.0"
    t.decimal "gross_pay", precision: 16, scale: 2, default: "0.0"
    t.decimal "medicare_tax", precision: 16, scale: 2, default: "0.0"
    t.decimal "net_pay", precision: 16, scale: 2, default: "0.0"
    t.decimal "social_security_tax", precision: 16, scale: 2, default: "0.0"
    t.integer "total_employees", default: 0
    t.datetime "updated_at", null: false
    t.decimal "withholding_tax", precision: 16, scale: 2, default: "0.0"
    t.integer "year", null: false
    t.index ["company_id", "year"], name: "index_company_ytd_totals_on_company_id_and_year", unique: true
    t.index ["company_id"], name: "index_company_ytd_totals_on_company_id"
  end

  create_table "deduction_types", force: :cascade do |t|
    t.boolean "active", default: true
    t.string "category", null: false
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.decimal "default_amount", precision: 10, scale: 2
    t.boolean "is_percentage", default: false
    t.string "name", null: false
    t.datetime "updated_at", null: false
    t.index ["category"], name: "index_deduction_types_on_category"
    t.index ["company_id", "name"], name: "index_deduction_types_on_company_id_and_name", unique: true
    t.index ["company_id"], name: "index_deduction_types_on_company_id"
  end

  create_table "department_ytd_totals", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "department_id", null: false
    t.decimal "gross_pay", precision: 16, scale: 2, default: "0.0"
    t.decimal "medicare_tax", precision: 16, scale: 2, default: "0.0"
    t.decimal "net_pay", precision: 16, scale: 2, default: "0.0"
    t.decimal "social_security_tax", precision: 16, scale: 2, default: "0.0"
    t.integer "total_employees", default: 0
    t.datetime "updated_at", null: false
    t.decimal "withholding_tax", precision: 16, scale: 2, default: "0.0"
    t.integer "year", null: false
    t.index ["department_id", "year"], name: "index_department_ytd_totals_on_department_id_and_year", unique: true
    t.index ["department_id"], name: "index_department_ytd_totals_on_department_id"
  end

  create_table "departments", force: :cascade do |t|
    t.boolean "active", default: true
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.datetime "updated_at", null: false
    t.index ["company_id", "name"], name: "index_departments_on_company_id_and_name", unique: true
    t.index ["company_id"], name: "index_departments_on_company_id"
  end

  create_table "districts", force: :cascade do |t|
    t.bigint "campaign_id", null: false
    t.integer "coordinator_id"
    t.datetime "created_at", null: false
    t.text "description"
    t.string "name"
    t.integer "number"
    t.datetime "updated_at", null: false
    t.index ["campaign_id"], name: "index_districts_on_campaign_id"
  end

  create_table "employee_deductions", force: :cascade do |t|
    t.boolean "active", default: true
    t.decimal "amount", precision: 10, scale: 2, null: false
    t.datetime "created_at", null: false
    t.bigint "deduction_type_id", null: false
    t.bigint "employee_id", null: false
    t.boolean "is_percentage", default: false
    t.datetime "updated_at", null: false
    t.index ["deduction_type_id"], name: "index_employee_deductions_on_deduction_type_id"
    t.index ["employee_id", "deduction_type_id"], name: "idx_employee_deductions_unique", unique: true
    t.index ["employee_id"], name: "index_employee_deductions_on_employee_id"
  end

  create_table "employee_ytd_totals", force: :cascade do |t|
    t.decimal "bonus", precision: 14, scale: 2, default: "0.0"
    t.datetime "created_at", null: false
    t.bigint "employee_id", null: false
    t.decimal "gross_pay", precision: 14, scale: 2, default: "0.0"
    t.decimal "insurance", precision: 14, scale: 2, default: "0.0"
    t.decimal "loans", precision: 14, scale: 2, default: "0.0"
    t.decimal "medicare_tax", precision: 14, scale: 2, default: "0.0"
    t.decimal "net_pay", precision: 14, scale: 2, default: "0.0"
    t.decimal "overtime_pay", precision: 14, scale: 2, default: "0.0"
    t.decimal "retirement", precision: 14, scale: 2, default: "0.0"
    t.decimal "roth_retirement", precision: 14, scale: 2, default: "0.0"
    t.decimal "social_security_tax", precision: 14, scale: 2, default: "0.0"
    t.decimal "tips", precision: 14, scale: 2, default: "0.0"
    t.datetime "updated_at", null: false
    t.decimal "withholding_tax", precision: 14, scale: 2, default: "0.0"
    t.integer "year", null: false
    t.index ["employee_id", "year"], name: "index_employee_ytd_totals_on_employee_id_and_year", unique: true
    t.index ["employee_id"], name: "index_employee_ytd_totals_on_employee_id"
  end

  create_table "employees", force: :cascade do |t|
    t.decimal "additional_withholding", precision: 10, scale: 2, default: "0.0"
    t.string "address_line1"
    t.string "address_line2"
    t.integer "allowances", default: 0
    t.string "bank_account_number_encrypted"
    t.string "bank_routing_number_encrypted"
    t.string "city"
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.date "date_of_birth"
    t.bigint "department_id"
    t.string "email"
    t.string "employment_type", default: "hourly", null: false
    t.string "filing_status", default: "single"
    t.string "first_name", null: false
    t.date "hire_date"
    t.string "last_name", null: false
    t.string "middle_name"
    t.string "pay_frequency", default: "biweekly"
    t.decimal "pay_rate", precision: 10, scale: 2, null: false
    t.string "phone"
    t.decimal "retirement_rate", precision: 5, scale: 4, default: "0.0"
    t.decimal "roth_retirement_rate", precision: 5, scale: 4, default: "0.0"
    t.string "ssn_encrypted"
    t.string "state"
    t.string "status", default: "active"
    t.date "termination_date"
    t.datetime "updated_at", null: false
    t.string "zip"
    t.index ["company_id", "last_name", "first_name"], name: "index_employees_on_company_id_and_last_name_and_first_name"
    t.index ["company_id"], name: "index_employees_on_company_id"
    t.index ["department_id"], name: "index_employees_on_department_id"
    t.index ["employment_type"], name: "index_employees_on_employment_type"
    t.index ["status"], name: "index_employees_on_status"
  end

  create_table "event_rsvps", force: :cascade do |t|
    t.boolean "attended"
    t.datetime "checked_in_at"
    t.integer "checked_in_by_id"
    t.datetime "created_at", null: false
    t.bigint "event_id", null: false
    t.string "rsvp_status"
    t.bigint "supporter_id", null: false
    t.datetime "updated_at", null: false
    t.index ["event_id"], name: "index_event_rsvps_on_event_id"
    t.index ["supporter_id"], name: "index_event_rsvps_on_supporter_id"
  end

  create_table "events", force: :cascade do |t|
    t.bigint "campaign_id", null: false
    t.datetime "created_at", null: false
    t.date "date"
    t.text "description"
    t.string "event_type"
    t.string "location"
    t.string "name"
    t.integer "quota"
    t.string "status"
    t.time "time"
    t.datetime "updated_at", null: false
    t.bigint "village_id"
    t.index ["campaign_id"], name: "index_events_on_campaign_id"
    t.index ["date"], name: "index_events_on_date"
    t.index ["event_type"], name: "index_events_on_event_type"
    t.index ["status"], name: "index_events_on_status"
    t.index ["village_id"], name: "index_events_on_village_id"
  end

  create_table "pay_periods", force: :cascade do |t|
    t.bigint "approved_by_id"
    t.datetime "committed_at"
    t.bigint "company_id", null: false
    t.datetime "created_at", null: false
    t.bigint "created_by_id"
    t.date "end_date", null: false
    t.text "notes"
    t.date "pay_date", null: false
    t.date "start_date", null: false
    t.string "status", default: "draft"
    t.datetime "updated_at", null: false
    t.index ["company_id", "end_date"], name: "index_pay_periods_on_company_id_and_end_date"
    t.index ["company_id", "start_date"], name: "index_pay_periods_on_company_id_and_start_date"
    t.index ["company_id", "status"], name: "index_pay_periods_on_company_id_and_status"
    t.index ["company_id"], name: "index_pay_periods_on_company_id"
    t.index ["status"], name: "index_pay_periods_on_status"
  end

  create_table "payroll_items", force: :cascade do |t|
    t.decimal "additional_withholding", precision: 10, scale: 2, default: "0.0"
    t.decimal "bonus", precision: 10, scale: 2, default: "0.0"
    t.string "check_number"
    t.datetime "check_printed_at"
    t.datetime "created_at", null: false
    t.jsonb "custom_columns_data", default: {}
    t.bigint "employee_id", null: false
    t.string "employment_type", null: false
    t.decimal "gross_pay", precision: 12, scale: 2, default: "0.0"
    t.decimal "holiday_hours", precision: 8, scale: 2, default: "0.0"
    t.decimal "hours_worked", precision: 8, scale: 2, default: "0.0"
    t.decimal "insurance_payment", precision: 10, scale: 2, default: "0.0"
    t.decimal "loan_payment", precision: 10, scale: 2, default: "0.0"
    t.decimal "medicare_tax", precision: 10, scale: 2, default: "0.0"
    t.decimal "net_pay", precision: 12, scale: 2, default: "0.0"
    t.decimal "overtime_hours", precision: 8, scale: 2, default: "0.0"
    t.bigint "pay_period_id", null: false
    t.decimal "pay_rate", precision: 10, scale: 2, null: false
    t.decimal "pto_hours", precision: 8, scale: 2, default: "0.0"
    t.decimal "reported_tips", precision: 10, scale: 2, default: "0.0"
    t.decimal "retirement_payment", precision: 10, scale: 2, default: "0.0"
    t.decimal "roth_retirement_payment", precision: 10, scale: 2, default: "0.0"
    t.decimal "social_security_tax", precision: 10, scale: 2, default: "0.0"
    t.decimal "total_additions", precision: 12, scale: 2, default: "0.0"
    t.decimal "total_deductions", precision: 12, scale: 2, default: "0.0"
    t.datetime "updated_at", null: false
    t.decimal "withholding_tax", precision: 10, scale: 2, default: "0.0"
    t.decimal "ytd_gross", precision: 14, scale: 2, default: "0.0"
    t.decimal "ytd_medicare_tax", precision: 14, scale: 2, default: "0.0"
    t.decimal "ytd_net", precision: 14, scale: 2, default: "0.0"
    t.decimal "ytd_retirement", precision: 14, scale: 2, default: "0.0"
    t.decimal "ytd_roth_retirement", precision: 14, scale: 2, default: "0.0"
    t.decimal "ytd_social_security_tax", precision: 14, scale: 2, default: "0.0"
    t.decimal "ytd_withholding_tax", precision: 14, scale: 2, default: "0.0"
    t.index ["check_number"], name: "index_payroll_items_on_check_number"
    t.index ["employee_id"], name: "index_payroll_items_on_employee_id"
    t.index ["pay_period_id", "employee_id"], name: "index_payroll_items_on_pay_period_id_and_employee_id", unique: true
    t.index ["pay_period_id"], name: "index_payroll_items_on_pay_period_id"
  end

  create_table "poll_reports", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "notes"
    t.bigint "precinct_id", null: false
    t.string "report_type", default: "turnout_update", null: false
    t.datetime "reported_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id"
    t.integer "voter_count", null: false
    t.index ["precinct_id", "reported_at"], name: "index_poll_reports_on_precinct_id_and_reported_at"
    t.index ["precinct_id"], name: "index_poll_reports_on_precinct_id"
    t.index ["user_id"], name: "index_poll_reports_on_user_id"
  end

  create_table "precincts", force: :cascade do |t|
    t.string "alpha_range"
    t.datetime "created_at", null: false
    t.string "number"
    t.string "polling_site"
    t.integer "registered_voters"
    t.datetime "updated_at", null: false
    t.bigint "village_id", null: false
    t.index ["village_id"], name: "index_precincts_on_village_id"
  end

  create_table "quotas", force: :cascade do |t|
    t.bigint "campaign_id", null: false
    t.datetime "created_at", null: false
    t.bigint "district_id"
    t.string "period"
    t.integer "target_count"
    t.date "target_date"
    t.datetime "updated_at", null: false
    t.bigint "village_id"
    t.index ["campaign_id"], name: "index_quotas_on_campaign_id"
    t.index ["district_id"], name: "index_quotas_on_district_id"
    t.index ["village_id"], name: "index_quotas_on_village_id"
  end

  create_table "supporters", force: :cascade do |t|
    t.bigint "block_id"
    t.string "contact_number"
    t.datetime "created_at", null: false
    t.date "dob"
    t.string "email"
    t.integer "entered_by_user_id"
    t.string "leader_code"
    t.boolean "motorcade_available"
    t.bigint "precinct_id"
    t.string "print_name"
    t.integer "referred_from_village_id"
    t.boolean "registered_voter"
    t.string "source"
    t.string "status"
    t.string "street_address"
    t.datetime "updated_at", null: false
    t.bigint "village_id", null: false
    t.boolean "yard_sign"
    t.index ["block_id"], name: "index_supporters_on_block_id"
    t.index ["entered_by_user_id"], name: "index_supporters_on_entered_by_user_id"
    t.index ["leader_code"], name: "index_supporters_on_leader_code"
    t.index ["precinct_id"], name: "index_supporters_on_precinct_id"
    t.index ["print_name", "village_id"], name: "index_supporters_on_name_village"
    t.index ["source"], name: "index_supporters_on_source"
    t.index ["status"], name: "index_supporters_on_status"
    t.index ["village_id"], name: "index_supporters_on_village_id"
  end

  create_table "tax_tables", force: :cascade do |t|
    t.decimal "additional_medicare_rate", precision: 6, scale: 5, default: "0.009"
    t.decimal "additional_medicare_threshold", precision: 12, scale: 2, default: "200000.0"
    t.decimal "allowance_amount", precision: 10, scale: 2
    t.jsonb "bracket_data", default: [], null: false
    t.datetime "created_at", null: false
    t.string "filing_status", null: false
    t.decimal "medicare_rate", precision: 6, scale: 5, default: "0.0145", null: false
    t.string "pay_frequency", null: false
    t.decimal "ss_rate", precision: 6, scale: 5, default: "0.062", null: false
    t.decimal "ss_wage_base", precision: 12, scale: 2, null: false
    t.integer "tax_year", null: false
    t.datetime "updated_at", null: false
    t.index ["tax_year", "filing_status", "pay_frequency"], name: "idx_tax_tables_year_status_frequency", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.integer "assigned_block_id"
    t.integer "assigned_district_id"
    t.integer "assigned_village_id"
    t.string "clerk_id"
    t.datetime "created_at", null: false
    t.string "email"
    t.string "name"
    t.string "phone"
    t.string "role"
    t.datetime "updated_at", null: false
    t.index ["clerk_id"], name: "index_users_on_clerk_id", unique: true
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["role"], name: "index_users_on_role"
  end

  create_table "villages", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "district_id"
    t.string "name"
    t.integer "population"
    t.integer "precinct_count"
    t.string "region"
    t.integer "registered_voters"
    t.datetime "updated_at", null: false
    t.index ["district_id"], name: "index_villages_on_district_id"
    t.index ["name"], name: "index_villages_on_name", unique: true
  end

  add_foreign_key "blocks", "villages"
  add_foreign_key "company_ytd_totals", "companies"
  add_foreign_key "deduction_types", "companies"
  add_foreign_key "department_ytd_totals", "departments"
  add_foreign_key "departments", "companies"
  add_foreign_key "districts", "campaigns"
  add_foreign_key "employee_deductions", "deduction_types"
  add_foreign_key "employee_deductions", "employees"
  add_foreign_key "employee_ytd_totals", "employees"
  add_foreign_key "employees", "companies"
  add_foreign_key "employees", "departments"
  add_foreign_key "event_rsvps", "events"
  add_foreign_key "event_rsvps", "supporters"
  add_foreign_key "events", "campaigns"
  add_foreign_key "events", "villages"
  add_foreign_key "pay_periods", "companies"
  add_foreign_key "payroll_items", "employees"
  add_foreign_key "payroll_items", "pay_periods"
  add_foreign_key "poll_reports", "precincts"
  add_foreign_key "poll_reports", "users"
  add_foreign_key "precincts", "villages"
  add_foreign_key "quotas", "campaigns"
  add_foreign_key "quotas", "districts"
  add_foreign_key "quotas", "villages"
  add_foreign_key "supporters", "blocks"
  add_foreign_key "supporters", "precincts"
  add_foreign_key "supporters", "villages"
  add_foreign_key "villages", "districts"
end
