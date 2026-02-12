# Campaign Tracker — Build Plan (POC for Feb 15 Meeting)

**Goal:** Walk into Saturday's meeting with a working demo that digitizes the blue form + shows a live dashboard.

---

## Decisions Made (Feb 12)

### Scope
- **POC focuses on:** Digital blue form + public QR signup + live dashboard
- **Referrals:** Phase 2 (after core functionality works)
- **Districts:** Configurable — admin can create/edit districts and assign villages. Not hardcoded.

### Tech Stack
- **Backend:** Rails 8 API (same as all Shimizu projects)
- **Frontend:** React + TypeScript + Tailwind + Vite
- **Auth:** Clerk (same as Three Squares, Hafaloha)
- **Database:** PostgreSQL
- **Hosting (POC):** Local demo for meeting, then Render + Netlify

### Auth Flow
- **Admin (Leon/Auntie Rose):** Creates accounts for higher-ups
- **Higher-ups:** Can invite lower admins/chiefs/leaders
- **No self-registration** for staff — accounts are created by someone above you
- **Public signup form:** No account needed (QR code / link)

### Blue Form Fields (from actual physical form)
**Header (auto-filled based on logged-in user):**
- District
- Village
- Section
- Block
- Date (auto)
- Name of Block Leader (auto)
- Contact No. of Block Leader (auto)

**Per Supporter:**
| Field | Type | Required? |
|-------|------|-----------|
| Print Name | text | ✅ |
| Contact Nos. | phone | ✅ |
| DOB | date | ❌ |
| Email Address | email | ❌ |
| Street Address | text | ❌ |
| Registered Voter (Y/N) | boolean | ✅ |

**Additional digital fields (not on paper form):**
| Field | Type | Notes |
|-------|------|-------|
| Precinct | select | Auto-detect from village if possible |
| Yard Sign (Y/N) | boolean | "Will you put a sign on your yard?" |
| Motorcade (Y/N) | boolean | "Will you join motorcades?" |
| Source | auto | "staff_entry" / "qr_signup" / "referral" |
| Entered By | auto | User who entered the data |

---

## Data Model

### Campaigns
- name, election_year, election_type, status, candidate_names, branding

### Districts (configurable)
- name, number, campaign_id, coordinator (user)

### Villages (reference data, pre-loaded)
- name, district_id, registered_voters, precinct_count

### Precincts (reference data, pre-loaded)
- number, alpha_range, village_id, registered_voters, polling_site

### Blocks/Sections
- name, village_id, leader (user)

### Users (Clerk-managed auth, app-managed roles)
- clerk_id, name, email, phone, role
- Roles: campaign_admin, district_coordinator, village_chief, block_leader, poll_watcher
- assigned_district_id, assigned_village_id, assigned_block_id

### Supporters (the blue form data)
- print_name, contact_number, dob, email, street_address
- village_id, precinct_id, block_id
- registered_voter (boolean)
- yard_sign (boolean), motorcade_available (boolean)
- source (staff_entry / qr_signup / referral)
- entered_by_user_id
- status (active / inactive / duplicate / unverified)

### Quotas
- village_id, target_count, target_date, period

---

## POC Scope (Build for Saturday)

### Must Have
1. **Public signup form** — Mobile-first, campaign-branded, QR code
   - Fields: Name, Phone, Village (dropdown), Street Address, Registered Y/N
   - Optional: Email, Yard Sign, Motorcade
   - "Thank you for supporting Josh & Tina!" confirmation
   - Generates unique QR per block leader

2. **Staff entry form** — Authenticated, matches blue form layout
   - Auto-fills district/village/block based on user
   - Bulk mode: submit and immediately start next entry
   - Duplicate detection (same name + village = flag)

3. **Live dashboard** — Real-time supporter counts
   - Island-wide view: 19 villages with progress bars
   - Click village → see precinct-level breakdown
   - Supporter count vs quota (thermometer style)
   - New signups today/this week

4. **Seed data** — All 19 villages, 72 precincts, real voter counts pre-loaded

### Nice to Have (if time)
5. Block leader leaderboard
6. CSV export of supporters
7. Basic role-based views (chief sees only their village)

### Explicitly NOT in POC
- Election day features (Phase 4)
- Referral system
- Event/motorcade management
- SMS/text capabilities
- Offline mode

---

## Pages

| Route | Page | Access |
|-------|------|--------|
| `/` | Public landing + QR signup form | Public |
| `/signup` | Direct signup form link | Public |
| `/signup/:leader_code` | Attributed signup (from QR) | Public |
| `/admin` | Dashboard overview | All staff |
| `/admin/supporters` | Supporter list + search + filter | All staff |
| `/admin/supporters/new` | Staff entry form (blue form digital) | All staff |
| `/admin/villages/:id` | Village detail view | Village chief+ |
| `/admin/settings` | District/village/quota config | Admin only |
| `/admin/users` | User management + invites | Admin only |

---

## Timeline

| Day | What |
|-----|------|
| **Wed night (Feb 12)** | Scaffold Rails + React, data model, seed data |
| **Thu (Feb 13)** | Public signup form, staff entry form, basic dashboard |
| **Fri (Feb 14)** | Polish dashboard, QR codes, role-based access, deploy demo |
| **Sat (Feb 15)** | Meeting — demo the POC |

---

*Reference: Blue form photo in `docs/blue-form-reference.jpg`*
