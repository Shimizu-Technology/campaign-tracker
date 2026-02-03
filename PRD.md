# Campaign Tracker — Product Requirements Document

**Version:** 1.0 (Draft)
**Date:** February 3, 2026
**Author:** Jerry (Shimizu Technology)
**Status:** DRAFT — Needs review & clarification before build

---

## 1. Overview

A web application to digitize and automate the campaign supporter tracking process for the Guam gubernatorial election. Replaces paper-based "Block List" forms with a digital system that handles supporter sign-up, quota tracking, organizational hierarchy management, event check-ins, and real-time election day voter turnout monitoring.

**Working Name:** Campaign Tracker (TBD — open to a better name)
**Campaign:** Josh Tenorio & Tina Muña Barnes for Governor & Lt. Governor

---

## 2. Problem Statement

The current campaign process is entirely manual:
- **Paper forms** ("Block List" / blue form) are used to collect supporter info — 10 names per sheet
- Block leaders hand-deliver forms up the chain to village chiefs → district coordinators → campaign HQ
- **Data entry** is manual — someone has to type everything into a spreadsheet
- **Quota tracking** (how many supporters per village by what date) is done by hand
- **Election day** relies on poll watchers physically highlighting names on paper lists, relaying info through runners to a "war room" where people manually cross-reference who hasn't voted
- **No real-time visibility** — campaign leadership can't see progress until data is manually compiled

This creates delays, errors, lost data, and no ability to course-correct in real-time.

---

## 3. Target Users & Roles

| Role | Who | What They Do | Access Level |
|------|-----|-------------|--------------|
| **Campaign Admin** | Auntie Rose, campaign leadership | Full system access, set quotas, manage hierarchy, war room on election day | Everything |
| **District Coordinator** | Heads of campaign districts (e.g., Leon's mom = District 2) | Manage village chiefs, see district-wide progress, enter supporters | Their district + all villages under it |
| **Village Chief** | Village-level campaign leader (+ optional co-chief) | Manage block leaders, see village progress, enter supporters | Their village + all blocks under it |
| **Block/Section Leader** | Grassroots-level, assigned to a neighborhood | Collect supporter sign-ups (paper or digital), enter data | Their block's supporters only |
| **Poll Watcher** | At voting sites on election day | Mark off voters as they vote | Their precinct's voter list (election day only) |
| **War Room Operator** | Campaign HQ on election day | Monitor all precincts, manage call bank, identify non-voters | Read-only dashboards + call lists |
| **Supporter** | The public | Self-signup via QR code / shared link (no account required) | Public form only |

---

## 4. Organizational Hierarchy

```
Campaign HQ (Auntie Rose)
└── District (internal campaign designation)
    ├── District Coordinator (e.g., Mom = District 2)
    └── Village (official Guam village)
        ├── Village Chief + Co-Chief
        └── Block / Section (neighborhood subdivision)
            └── Block Leader
                └── Supporters (the actual people)
```

**Key distinction:**
- **Village** = official Guam municipality (e.g., Tamuning, Dededo, Yigo)
- **Precinct** = election commission voting division (a large village may have multiple precincts)
- **District** = internal campaign grouping of villages (NOT a government designation)
- **Block/Section** = subdivision of a village, defined by the village chief

---

## 5. Data Model (Conceptual)

### 5.1 Organizational Structure

**Districts**
- name, number, description
- coordinator (user reference)

**Villages**
- name, district_id
- chief (user reference), co_chief (user reference)
- precinct_ids (a village may span multiple precincts)
- quota targets (by period)

**Precincts**
- number/name, village_id (or village_ids if a precinct spans villages?)
- polling_location (name, address)
- registered_voter_count (from election commission data)

**Blocks/Sections**
- name/number, village_id
- leader (user reference)

### 5.2 People

**Users** (campaign staff — anyone with a login)
- name, email, phone, role, password
- assigned_district_id, assigned_village_id, assigned_block_id (based on role)

**Supporters** (collected from blue forms / digital sign-up)
- print_name, contact_number, dob, email, street_address
- village, precinct, block/section
- registered_voter (Y/N)
- yard_sign (Y/N)
- motorcade_available (Y/N)
- source: "block_leader_entry" | "self_signup" | "referral"
- entered_by (user reference, null if self-signup)
- referral_from (village/user, if referral)
- created_at (auto-timestamp)
- status: "active" | "inactive" | "duplicate" | "unverified"

**Registered Voters** (imported from election commission)
- name, precinct, village
- This is the master list used on election day to check off who voted

### 5.3 Election Day

**Vote Tracking**
- registered_voter_id
- precinct_id
- voted_at (timestamp)
- marked_by (poll watcher user)
- hour_block (for hourly reporting)

### 5.4 Events

**Motorcades / Events**
- name, date, location
- expected_attendees (from supporter motorcade_available)
- check_ins (supporter_id, checked_in_at)

### 5.5 Quotas

**Quota Targets**
- village_id (or district_id)
- period: "weekly" | "monthly" | "quarterly"
- target_date
- target_count
- actual_count (computed)

---

## 6. Features by Phase

### Phase 1: Digital Blue Form + Supporter Database (URGENT — need by ~Feb 23)

**6.1 Digital Block List Form (Staff Entry)**
- Authenticated users (block leaders, chiefs, coordinators) can enter supporters
- Form mirrors the blue form fields + new fields (precinct, yard sign, motorcade)
- Auto-fills district/village/block based on who's logged in
- Bulk entry mode — enter multiple supporters quickly (tab through fields)
- Duplicate detection (same name + village = flag for review)

**6.2 Public Self-Signup (QR Code / Link)**
- No login required
- Simple mobile-friendly form: name, phone, email, DOB, address, village
- Auto-detects precinct from village (if mapping is known?)
- Generates unique QR codes per block leader / village chief
- QR code encodes a URL with the leader's ID so the supporter gets attributed correctly
- Confirmation page: "Thank you for supporting Josh & Tina!"
- Optional: referral field ("Who referred you?")

**6.3 Referral Form**
- When a supporter lives in a different village than the person collecting
- Enter supporter info + target village
- Routes to the correct village chief for approval/addition
- Notification to receiving village chief

**6.4 Supporter Dashboard**
- List all supporters with search, filter, sort
- Filter by: village, precinct, block, registered Y/N, date range, source
- Export to CSV/Excel
- Deduplication tools
- Bulk edit (e.g., mark 50 supporters as verified)

### Phase 2: Quota Tracking + Reporting (need by early March)

**6.5 Quota Management**
- Admin sets targets: "Tamuning needs 493 supporters by Feb 23"
- Targets per village, per period (weekly/monthly/quarterly)
- Auto-calculated progress based on supporter entries

**6.6 Progress Dashboards**
- **Campaign-wide:** Total supporters vs goal, broken down by district
- **District view:** Each village's progress, thermometer visualization
- **Village view:** Block-by-block breakdown, daily/weekly trends
- Color coding: Green (on track) / Yellow (behind) / Red (critical)
- "Names needed per day to hit target" calculation

**6.7 Reports**
- Weekly summary by district/village (PDF export)
- Monthly quota report (Q1, Q2, Q3, Q4)
- Supporter growth over time (line chart)
- New sign-ups this week/month
- Block leader leaderboard (gamification — who's collecting the most?)

### Phase 3: Event Management (March–July)

**6.8 Motorcade Check-in**
- Create motorcade events (date, time, location, minimum attendees needed)
- RSVP list auto-populated from supporters with motorcade_available = Y
- Day-of check-in: QR scan or manual search to mark attendance
- Post-event report: Expected vs actual attendance
- Track reliability (who says yes but doesn't show up)

**6.9 General Event Tracking**
- Rallies, fundraisers, community events
- Attendance tracking
- Supporter touchpoint history ("Leon attended 3 motorcades, 1 rally")

### Phase 4: Election Day War Room (ready by mid-July for Aug 1 primary)

**6.10 Poll Watcher Interface**
- Mobile-optimized (phone-first)
- Assigned to a specific precinct
- Shows list of ALL registered voters for that precinct
- Our supporters are highlighted/flagged
- Tap to mark "VOTED" + timestamp
- Works offline (sync when connection available — polling sites may have spotty internet)
- Batch update mode (mark multiple voters quickly)

**6.11 War Room Dashboard**
- Real-time overview of ALL precincts
- Per-precinct thermometer: supporters voted / total supporters
- Color-coded status: Green (>75%) / Yellow (50-75%) / Red (<50%)
- Running totals updated as poll watchers mark votes
- Timeline view: votes per hour across all precincts
- "Danger zones" — precincts falling behind highlighted

**6.12 Call Bank**
- Auto-generated list: supporters who HAVEN'T voted yet
- Sortable by priority (e.g., those who RSVP'd to motorcades = more committed)
- "Call assigned" / "Called — will vote" / "Called — no answer" / "Voted" status
- Multiple war room operators can work the list without duplicating calls
- Phone number click-to-call on mobile

**6.13 Election Day Reports**
- Per-village: total registered voters, total supporters, voted count, % turnout
- Per-precinct: same metrics
- Hourly snapshots
- Final results compilation
- Post-election analysis: how accurate were our supporter predictions?

---

## 7. Technical Architecture (Proposed)

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Backend | Rails 8 API | Fast to build, proven stack, same as other Shimizu projects |
| Frontend | React + Vite + TypeScript + Tailwind | Same stack, reusable components |
| Database | PostgreSQL | Relational data, good for reporting |
| Auth | Simple email/password (built-in) | Campaign staff only — no public accounts needed |
| Hosting | Render (API) + Netlify (frontend) | Same as other projects |
| Real-time | ActionCable (WebSockets) or polling | For election day live updates |
| Offline | Service Worker + IndexedDB | Poll watchers need offline capability |
| QR Codes | `rqrcode` gem (backend) or client-side JS | For self-signup links |

**Mobile-first design** — block leaders are in the field, poll watchers are on phones.

---

## 8. Branding & Design

- Campaign colors: Match Josh & Tina campaign (blue from the form — need exact hex codes)
- Logo: "Vote Josh & Tina" branding on public-facing pages
- Internal pages: Clean, professional, fast
- Follow Shimizu frontend design guide (SVG icons, no emojis, 44px touch targets, Framer Motion)

---

## 9. Timeline (Proposed)

| Phase | Target | What Ships |
|-------|--------|-----------|
| Phase 1 | Feb 10-14 | Digital form, QR signup, supporter database |
| Phase 2 | Feb 21 | Quota dashboards, reporting (before Feb 23 deadline) |
| Phase 3 | March-April | Motorcade check-in, events |
| Phase 4 | July | Election day war room, poll watcher app, call bank |

**Critical date:** Feb 23 — first quota deadline (493 names for Tamuning)
**Critical date:** Aug 1 — Primary Election Day

---

## 10. ❓ Questions & Clarifications Needed

### Must Answer Before Building

1. **How many districts, villages, and precincts are there?** Need the full organizational map to seed the database. Can Auntie Rose provide a list?

2. **What are the actual quota numbers?** 493 for Tamuning by Feb 23 — what about every other village? Is there a master quota sheet?

3. **Who is Ryan?** (From notes: "After Ryan comes up with the list that they use to see the reports") — Is Ryan doing data entry now? Will they use this system?

4. **Precinct-to-village mapping** — Do we have a list of all precincts and which village(s) they belong to? This is critical for election day.

5. **Registered voter list** — How does the campaign get the master list of registered voters from the election commission? What format? (PDF, Excel, database?) Can we get a sample?

6. **Calvo's QR system** — Can Leon get a screenshot or link to see what the competing campaign is doing? Good to match or beat it.

7. **Who are the admins?** Just Auntie Rose? A team? How many people will have full access?

8. **Multi-campaign or single?** Is this ONLY for Josh & Tina, or should we build it to be reusable for future elections? (Affects architecture — multi-tenant vs single-tenant)

9. **Domain / hosting?** Will this live on a campaign domain? Or a Shimizu Technology subdomain for now?

10. **Budget for SMS?** If we want to send text reminders to supporters or use SMS for the call bank, there's a cost per message (Twilio). Is that in scope?

### Should Clarify But Won't Block Phase 1

11. **Referral form approval flow** — When someone refers a supporter to a different village, does the village chief need to approve it? Or auto-add?

12. **Data privacy / legal** — Any Guam-specific laws about storing voter data or supporter information digitally? Campaign finance implications?

13. **Previous election data** — The notes mention "a support list from the previous election." Is there existing data to import? What format?

14. **Internet at polling sites** — Do all voting locations have reliable WiFi/cell signal? If not, offline mode becomes critical for Phase 4.

15. **Poll watcher logistics** — How many poll watchers per precinct? Do they rotate shifts? Multiple devices per precinct?

16. **War room size** — How many operators in the call bank? 5? 20? 50? (Affects concurrent user load)

17. **"Hour or period" highlighting** — The transcript mentions poll watchers use different colored markers for different time periods. Should the digital version track the hour/period when each vote is recorded? (I'd say yes — useful for turnout analysis)

18. **Block leader accountability** — Should block leaders be able to see each other's numbers? Or only their own? (Gamification vs privacy)

19. **Supporter verification** — Is there a step where someone verifies the supporter data is accurate before it counts toward quotas? Or does every entry count immediately?

20. **Duplicate handling** — Same person signed up by a block leader AND via QR code. How to handle? Auto-merge? Flag for review?

---

## 11. Out of Scope (for now)

- OCR/scanning of existing paper forms (mentioned in meeting — revisit later)
- Automated phone calls / robocalls
- Social media integration
- Campaign donation tracking
- Candidate scheduling / tour planning
- Media/press management

---

## 12. Success Metrics

- **Phase 1:** All block leaders entering data digitally instead of paper by Feb 23
- **Phase 2:** Campaign leadership can see live quota progress without asking anyone
- **Phase 4:** Election day voter tracking happens in real-time, not hours delayed
- **Overall:** More supporters contacted, higher turnout on election day

---

*This PRD is a living document. Update as questions are answered and requirements evolve.*
