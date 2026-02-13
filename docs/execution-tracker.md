# Campaign Tracker Execution Tracker

Last updated: 2026-02-13  
Purpose: single operational checklist for what is done, what is in progress, and what comes next.

---

## How to Use This

- Move items between sections as work progresses.
- Keep status labels current: `todo`, `in_progress`, `blocked`, `done`.
- Only mark `done` when acceptance criteria are met.

---

## Done

### Core Product Foundations
- [x] Public supporter signup flow (`/signup`) implemented.
- [x] Staff supporter entry flow (`/admin/supporters/new`) implemented.
- [x] Supporter listing with filters and mobile improvements implemented.
- [x] Village detail to supporters drill-down flow implemented.
- [x] Precinct assignment workflow for unassigned supporters implemented.
- [x] Dynamic back/home navigation improvements implemented.

### Supporter Detail + Tracking
- [x] Supporter profile page route implemented (`/admin/supporters/:id`).
- [x] Show-first UX with explicit edit mode (`Edit` -> `Save` / `Cancel`) implemented.
- [x] Unsaved-changes guard for back/home/cancel/browser-close implemented.
- [x] Basic audit log model/table integrated and displayed on supporter detail.

### Security / Stability / Quality
- [x] Auth sync/reload-loop issues resolved.
- [x] ActionCable authentication hardened.
- [x] SMS authorization tightened (coordinator-or-above for high-impact sends).
- [x] Source attribution logic improved for staff vs public flow.
- [x] CI/lint/build/test baseline repaired and passing for current changes.

---

## Now (Current Priority)

### 1) Role-Gated Supporter Editing
- Status: `todo`
- Goal: restrict who can edit supporter records while keeping read access for staff.
- Scope:
  - Backend authorization on supporter update endpoint.
  - Frontend edit controls hidden/disabled for unauthorized roles.
  - Clear UX message for read-only users.
- Acceptance criteria:
  - Unauthorized roles receive `403` on update attempts.
  - Authorized roles can edit and save successfully.
  - Automated tests cover allowed and forbidden cases.

### 2) Audit Log Depth Improvement
- Status: `todo`
- Goal: make audit history operationally useful.
- Scope:
  - Store field-level diffs (`from` -> `to`) for updates.
  - Include actor role + action label in response/UI.
  - Keep list ordered by newest first.
- Acceptance criteria:
  - Every supporter edit produces a readable diff entry.
  - UI clearly shows who changed what and when.
  - Backend tests verify audit payload shape.

### 3) Core Flow Verification Pass
- Status: `todo`
- Goal: verify end-to-end real workflow on desktop + mobile.
- Scope:
  - Public signup -> supporter appears in admin.
  - Assignment/edit on supporter detail.
  - Audit entry appears immediately after save.
- Acceptance criteria:
  - Full checklist passes with no blocking defects.

---

## Next (After Now Is Stable)

### 4) Legacy Source Backfill (Safe Cleanup)
- Status: `todo`
- Scope:
  - Add dry-run backfill task for historical supporter `source` values.
  - Review output before applying.
- Acceptance criteria:
  - Dry-run report reviewed and approved.
  - Apply run completes with summary counts.

### 5) Performance Hardening
- Status: `todo`
- Scope:
  - Add short-lived dashboard caching.
  - Profile and optimize war-room endpoint.
  - Validate/add DB indexes for frequent filters and sorts.
- Acceptance criteria:
  - Measurable reduction in response time/query count on target endpoints.

### 6) E2E Smoke Automation
- Status: `todo`
- Scope:
  - Add one browser E2E happy-path smoke test.
- Acceptance criteria:
  - CI can run a basic critical-flow test successfully.

---

## Later (Phase 2+)

### Product Enhancements
- Status: `todo`
- Structured address fields (street/city/zip shape aligned to campaign ops).
- Configurable precinct management by admins.
- Optional supporter confirmation email flow.
- Phone input masking for friendlier entry format.

### Election-Day Scale Enhancements
- Status: `todo`
- War room performance/load hardening.
- Poll watcher offline reliability and sync strategy refinement.

---

## Decision Log (Quick Notes)

- 2026-02-13: Adopt show-first supporter detail UX; editing requires explicit action.
- 2026-02-13: Track execution in this document as the operational source of truth.
