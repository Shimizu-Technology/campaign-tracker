# Poll Watcher Operations Spec

Last updated: 2026-02-13

This document defines what poll watchers do on election day and how that maps to the app workflow.
It is the pre-implementation reference for Item 7 in `docs/execution-tracker.md`.

---

## Purpose

- Give the campaign a fast, repeatable way to track supporter turnout during election day.
- Keep field updates scoped to assigned precincts.
- Feed war room call lists in near real-time so "not yet voted" supporters can be contacted.

Important: this is campaign operations data, not official election records.

---

## Poll Watcher Role Scope

Poll watchers are election-day operators focused on turnout reporting.

### Allowed
- Access `Poll Watcher` and `War Room` election-day tools.
- View only precincts they are assigned to.
- Submit precinct turnout snapshots and issue flags.
- Mark supporter-level turnout status for assigned precinct supporters.
- Log contact outcomes for outreach attempts.

### Not Allowed
- Access supporter CRUD pages outside election-day workflow.
- Edit campaign configuration (quotas, precinct metadata, users).
- View or modify data outside assigned precinct scope.

---

## Election-Day Workflow

## 1) Pre-open (setup)
- Confirm watcher login works and assigned precincts are visible.
- Confirm polling site, precinct number, and registered voter baseline are correct.
- Confirm escalation channel (war room lead contact) is known.

## 2) During polling (repeat cycle)
- Capture latest precinct turnout count.
- Submit a precinct report update (voter count + optional issue notes).
- Work strike list of known supporters in precinct:
  - mark `voted` when confirmed
  - leave/mark `not_yet_voted` when still pending
- Log outreach outcomes for call/SMS/door attempts:
  - attempted
  - reached
  - wrong number / unavailable
  - refused / not supporter
- Escalate blocking issues immediately (site disruption, data mismatch, etc.).

## 3) Closeout
- Submit final turnout snapshot for precinct.
- Ensure high-priority unresolved supporters are handed off to war room.
- Confirm no unsent local changes remain in app session.

---

## Data Events to Capture

## Precinct report event
- `precinct_id`
- `reported_at`
- `voter_count`
- `report_type` (`normal` or `issue`)
- `notes` (optional)
- `reported_by_user_id`

## Supporter turnout event
- `supporter_id`
- `turnout_status` (`not_yet_voted`, `voted`, `unknown`)
- `updated_at`
- `updated_by_user_id`
- `source` (`poll_watcher`, `war_room`, `admin_override`)
- `note` (optional)

## Contact outcome event
- `supporter_id`
- `outcome` (`attempted`, `reached`, `wrong_number`, `unavailable`, `refused`)
- `channel` (`call`, `sms`, `in_person`)
- `recorded_at`
- `recorded_by_user_id`
- `note` (optional)

---

## War Room Handoff Expectations

War room should be able to consume watcher updates immediately:

- Queue: supporters with `not_yet_voted`
- Breakdowns: by village, precinct, and priority
- Counters:
  - remaining
  - attempted
  - reached
  - voted
- Escalation feed: precinct issue reports requiring coordinator action

---

## Guardrails and Compliance

- Strict precinct assignment scope for poll watchers (read and write).
- Full audit logging for turnout and outreach status changes:
  - actor
  - timestamp
  - from -> to values
  - source + note metadata (when present)
- Explicit UI label that turnout markers are campaign-tracked operational records.

---

## Implementation Mapping (Execution Tracker Item 7)

- `7.1` Data model + migration:
  - Add supporter turnout fields and outreach logging schema.
- `7.2` Backend API:
  - Precinct-scoped strike-list fetch + turnout/outreach update endpoints.
- `7.3` Audit + compliance:
  - Full change log and campaign-data disclaimers.
- `7.4` Poll watcher UI:
  - Mobile-first strike-list actions and rapid status toggles.
- `7.5` War room queue integration:
  - Live not-yet-voted queue and progress counters.
- `7.6` Tests + QA:
  - Role/scope tests and election-day simulation checklist.
- `7.7` Rollout readiness:
  - Operator rehearsal and assignment validation.

---

## Open Questions to Confirm with Campaign Ops

- How often should watchers submit turnout snapshots (every X minutes vs event-driven)?
- Can multiple watchers be assigned to the same precinct, and if so, who wins conflicts?
- Which outreach outcomes are mandatory vs optional?
- What is the escalation SLA for precinct issues (immediate, 5 min, 15 min)?
- Do we need offline queueing for polling sites with weak connectivity in v1?
