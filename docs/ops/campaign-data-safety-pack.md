# Campaign Data Safety Pack

Last updated: 2026-04-21

## Purpose

This is the operator runbook for protecting campaign data in Campaign Tracker with the smallest practical approval surface.

It covers:
- the **current Josh & Tina production posture**
- the **required separate posture for any Democratic Party deployment**
- the minimum backup and restore expectations before we call the system safe enough for production use

## Current known reality

Based on this repo and its docs:
- **Frontend hosting:** Netlify
- **API hosting:** Render
- **Production database:** Neon Postgres
- **Current campaign in this repo:** Josh Tenorio & Tina Muña Barnes ("Josh & Tina 2026")

Repo references:
- `AGENTS.md` confirms **Render + Netlify** hosting.
- `docs/build-plan.md` specifies **PostgreSQL (Neon for prod)** and **Render (API) + Netlify (frontend)**.
- `README.md` documents deployment environment variables for the current Render / Netlify setup.

## Data-lane reality

### Josh & Tina current posture

Today, this repo is clearly built around the **Josh & Tina** campaign.

That means the current expected production lane is:
- one Render API deployment
- one Netlify frontend deployment
- one Neon production database for Campaign Tracker data

### Democratic Party future posture

The **Democratic Party deployment must be treated as a separate data lane**.

That means:
- **not** sharing the Josh & Tina production database
- **not** assuming the current repo deployment is already separated for Democratic Party use
- **not** calling Democratic Party production-ready until its own database, backup path, restore owner, and secrets are explicitly in place

## What we know vs. what we do not know

Known:
- Campaign Tracker is designed to run on **Render + Netlify + Neon**.
- Josh & Tina is the currently documented campaign context.
- A separate Democratic Party production lane is required if their data must remain operationally distinct.

Not confirmed from this repo:
- a separate Democratic Party repo
- a separate Democratic Party Neon project/database
- a separate Democratic Party Render service
- a separate Democratic Party Netlify site
- a tested Democratic Party restore procedure

**Implication:** until those items exist, Democratic Party should be treated as **not yet production-ready**.

## Preferred backup posture

Plain English:

> Keep Josh & Tina on its own Neon production database and back it up on a defined schedule with a named restore owner. If Democratic Party launches, give it its **own completely separate Neon database and backup chain** from day one. Do not rely on "we can export it later" as the backup plan.

### Recommended standard

For **each production data lane** (Josh & Tina now; Democratic Party later):
- one dedicated Neon production database
- Neon point-in-time recovery and/or scheduled logical backups enabled
- backup copies retained outside day-to-day operator memory
- one named human owner who can execute restore steps
- a documented restore drill completed and dated

## Minimum retention expectation

Recommended minimum:
- **Point-in-time restore window:** at least **7 days**
- **Logical backup retention:** at least **30 days**
- **Monthly snapshot retention:** at least **3 months** for operational safety

If platform limits prevent this exact setup, the owner should document the actual retention and get explicit approval for the gap.

## Restore expectation

Recommended operator expectation:
- confirm a restore path exists for accidental deletes, bad imports, or operator error
- be able to restore to a clean database copy without touching the live database first
- be able to validate row counts / critical tables before cutover
- target a **same-day restore drill** and a practical recovery path that can be executed by one named owner

Operational target:
- **First restore copy available within 60 minutes** for a standard incident
- production cutover decision made by campaign owner after validation

## Ownership

Minimum named owners required:
- **System owner:** approves production posture for the campaign lane
- **Restore owner:** person who can perform the Neon restore and update Render secrets/config if needed
- **Secrets owner:** person who controls Neon, Render, Netlify, and password manager entries

If one person holds all three roles, document that explicitly instead of leaving it implied.

## Approval-needed items

Leon only needs to approve a small set of things:

1. **Josh & Tina backup standard**
   - Approve Neon backup posture and retention target for the current production lane.
2. **Democratic Party separation rule**
   - Approve that Democratic Party cannot share Josh & Tina production data.
3. **Named owners**
   - Approve who owns restore execution and secrets.
4. **Restore drill cadence**
   - Approve a first restore drill before or immediately after production go-live, then repeat on a defined schedule.

## Implementation checklist

### Josh & Tina current lane

- [ ] Confirm the live Neon project/database name for Josh & Tina
- [ ] Confirm the live Render API service for Josh & Tina
- [ ] Confirm the live Netlify site for Josh & Tina
- [ ] Confirm Neon backup / restore capability is enabled for the production database
- [ ] Confirm retention window actually available on the selected Neon plan
- [ ] Define where logical exports or snapshots are stored, if used in addition to Neon restore features
- [ ] Name the restore owner
- [ ] Name the secrets owner
- [ ] Store all production credentials in approved secret storage
- [ ] Run one restore drill and record the result

### Democratic Party separate lane

- [ ] Provision a **separate** Neon project/database
- [ ] Provision separate Render and Netlify deployments if this becomes a distinct production environment
- [ ] Create separate secrets for Democratic Party services
- [ ] Confirm a separate backup path and retention window
- [ ] Name a Democratic Party restore owner
- [ ] Run a restore drill against the Democratic Party lane before calling it production-ready

## Restore drill checklist

Use this before signing off on any production data lane.

- [ ] Pick a recent restore point or backup snapshot
- [ ] Restore into a **new non-production database copy**
- [ ] Verify app can connect using temporary credentials
- [ ] Validate critical tables exist and expected data volumes look sane
- [ ] Spot-check key records relevant to campaign operations
- [ ] Record how long restore took end to end
- [ ] Record any manual steps required in Neon / Render
- [ ] Record who executed the drill
- [ ] Record pass / fail and follow-up fixes

## Decision summary

- **Josh & Tina:** current production campaign lane in this repo; back it up and assign a restore owner now.
- **Democratic Party:** must be a separate production data lane; do **not** assume it is already provisioned.
- **Approval surface:** retention target, named owners, and the rule that Democratic Party does not share Josh & Tina production data.
