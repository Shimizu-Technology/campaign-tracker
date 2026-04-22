# Campaign Data Safety Pack

Last updated: 2026-04-23

## Purpose

This document is the decision pack for Campaign Tracker backup and restore posture.

It is written to answer four operator questions clearly:
- What is the **preferred backup path**?
- What is the **fallback backup path**?
- What exactly do **Josh & Tina operators need to do now**?
- What exactly does **Leon need to approve**?

## Current known reality from this repo

Confirmed from repo docs:
- **Frontend hosting:** Netlify
- **API hosting:** Render
- **Production database platform:** Neon Postgres
- **Current campaign context in this repo:** Josh Tenorio & Tina Muña Barnes ("Josh & Tina 2026")

Repo references:
- `AGENTS.md` confirms **Render + Netlify** hosting.
- `docs/build-plan.md` specifies **PostgreSQL (Neon for prod)** and **Render (API) + Netlify (frontend)**.
- `README.md` documents deployment environment variables for the current Render / Netlify setup.

Not confirmed from this repo:
- the exact production Neon project name
- whether Neon hosted backups are already enabled on the live production database
- the exact Neon retention window on the current plan
- the exact production Render service name
- the exact production Netlify site name
- the exact person who currently owns restore execution
- whether an off-host logical backup job already exists

Where the repo does not confirm something, this document labels it as **not yet confirmed** instead of assuming it.

## Non-negotiable data-lane rule

### Josh & Tina

Josh & Tina is the current documented production lane in this repo.

Operationally, that means the expected live lane is:
- one Render API deployment
- one Netlify frontend deployment
- one Neon production database

### Democratic Party

The Democratic Party deployment must be treated as a **separate production data lane**.

That means:
- it must **not** share the Josh & Tina production database
- it must **not** share the Josh & Tina backup chain
- it must have its **own** restore owner and secrets path documented
- it must **not** be called production-ready until those items exist

> Separate frontend or backend deploys are not enough by themselves. The database and backup path must also be separate.

## Decision summary

### Preferred path

The preferred production backup path is:

> **Use managed hosted backups on Neon for each separate production database, with a named restore owner for each lane.**

In plain English:
- Josh & Tina keeps its own Neon production database.
- If Democratic Party launches, it gets its **own separate Neon production database**.
- Each production database relies first on **Neon-managed backup / restore capability**.
- Each production lane has one clearly named human who owns restore execution.

This is the preferred path because it is the smallest, cleanest operational setup if Neon restore features are available on the selected production plan.

### Fallback path

If managed hosted backups are not available, not sufficient, or not approved for the required retention window, the fallback path is:

> **Run logical `pg_dump` backups from Render on a schedule and store them in encrypted off-host object storage.**

In plain English:
- the backup job runs from the Render side on a defined schedule
- the job creates logical Postgres dumps with `pg_dump`
- the dumps are written to encrypted object storage that is **not** the live database host
- retention is documented per lane
- restore steps are documented and owned by a named human

This fallback should be treated as the backup-of-record only if the preferred Neon-managed path is unavailable or insufficient.

## What “done” looks like

For **each production lane**:
- one dedicated Neon production database
- one documented backup path
- one documented restore owner
- one documented secrets owner
- one completed restore drill recorded with date and result

For **Democratic Party specifically**:
- the lane is separate from Josh & Tina at the database level
- the lane is separate from Josh & Tina at the backup level
- the lane is not called ready until both are true

## Minimum handoff packet

Before this leaves Leon's hands, the operator packet should contain the following plain-language outputs:
- production database name and hosting vendor for each lane
- production Render service name for each lane
- production Netlify site name for each lane
- backup method in use: Neon-managed or scheduled `pg_dump`
- actual retention window
- restore owner name and contact path
- secrets owner name and contact path
- date of the last successful restore drill
- location of the restore notes or runbook

If any item is unknown, label it **not yet confirmed**. Do not leave operators to infer ownership or infrastructure names from memory.

## Restore ownership

Minimum ownership that must be explicit:
- **System owner** — the person accountable for the production posture
- **Restore owner** — the person who can execute the restore path without guesswork
- **Secrets owner** — the person who controls Neon, Render, Netlify, and secret storage access

If one person holds multiple roles, document that plainly.

## Execution checklist

This is the operator checklist. It is intentionally specific.

Recommended order of operations:
1. Confirm the live lane and owners
2. Confirm the preferred backup path and retention
3. Add the fallback path only if the preferred path is insufficient
4. Run the restore drill
5. Record the final handoff packet before sign-off

### A. Josh & Tina — do now

#### Confirm the lane
- [ ] Confirm the live Neon production database for Josh & Tina
- [ ] Confirm the live Render API service for Josh & Tina
- [ ] Confirm the live Netlify site for Josh & Tina

#### Set the preferred path first
- [ ] Check whether **Neon-managed hosted backup / restore** is available on the live Josh & Tina production database
- [ ] Record the actual Neon retention window available on the current plan
- [ ] Record who can execute a Neon restore for Josh & Tina
- [ ] Record who owns Josh & Tina production secrets

#### If the preferred path is not enough, set the fallback
- [ ] Decide whether Neon-managed backups are sufficient for Josh & Tina
- [ ] If **no**, create a Render-scheduled logical backup job using `pg_dump`
- [ ] Store those dumps in **encrypted off-host object storage**
- [ ] Record the retention policy for those dumps
- [ ] Record who checks job success and backup freshness

#### Prove restore works
- [ ] Run one restore drill into a **new non-production database copy**
- [ ] Verify the app can connect using temporary credentials
- [ ] Spot-check critical data and basic row-count sanity
- [ ] Record who ran the drill, how long it took, and pass/fail

### B. Democratic Party — required before launch

#### Provision a separate lane
- [ ] Create a **separate Neon production database** for Democratic Party
- [ ] Confirm Democratic Party does **not** share the Josh & Tina production database
- [ ] Create separate production secrets for Democratic Party services
- [ ] Confirm the Render deployment for Democratic Party points to the Democratic Party database
- [ ] Confirm the Netlify deployment for Democratic Party points to the correct Democratic Party environment

#### Set the preferred path first
- [ ] Enable or confirm **Neon-managed hosted backup / restore** for the Democratic Party production database
- [ ] Record the actual retention window available on that lane
- [ ] Name the Democratic Party restore owner
- [ ] Name the Democratic Party secrets owner

#### If the preferred path is not enough, set the fallback
- [ ] If Neon-managed backups are unavailable or insufficient, create a Render-scheduled `pg_dump` job for the Democratic Party lane
- [ ] Store Democratic Party dumps in **encrypted off-host object storage**
- [ ] Keep Democratic Party backup storage operationally separate from Josh & Tina wherever practical
- [ ] Record the retention policy and monitoring owner

#### Prove restore works before sign-off
- [ ] Run a restore drill against the Democratic Party lane before calling it production-ready
- [ ] Restore into a new non-production database copy
- [ ] Validate the restored data before any cutover decision
- [ ] Record date, operator, timing, and pass/fail result

## Restore drill standard

Use this for either lane.

- [ ] Pick a recent restore point or logical backup file
- [ ] Restore into a **new non-production database copy**
- [ ] Verify credentials and app connectivity
- [ ] Validate critical tables exist
- [ ] Spot-check expected data volumes and key records
- [ ] Record elapsed time end-to-end
- [ ] Record any manual Neon, Render, or secret-rotation steps
- [ ] Record pass/fail and follow-up fixes

## Leon approval surface

Leon should only need to answer a small set of yes/no decisions.

### Approval questions

1. **Preferred path**
   - Yes / No: Use **Neon-managed hosted backups** as the default backup path for each separate production database.

2. **Fallback path**
   - Yes / No: If the Neon-managed path is unavailable or insufficient, allow **Render-scheduled `pg_dump` backups to encrypted off-host object storage**.

3. **Separation rule**
   - Yes / No: Democratic Party must have its **own separate production database and backup chain**, and may not share Josh & Tina production data.

4. **Restore ownership**
   - Yes / No: Require one named restore owner and one named secrets owner per production lane before launch.

5. **Restore proof**
   - Yes / No: No production sign-off without one completed restore drill per lane.

## Recommended answer set

Based on what this repo documents today, the recommended answer set is:
- **Yes** to Neon-managed backups as the preferred path
- **Yes** to Render-scheduled `pg_dump` to encrypted off-host object storage as the fallback path
- **Yes** to strict Democratic Party data-lane separation
- **Yes** to named restore and secrets ownership
- **Yes** to restore drill before sign-off

## Bottom line

- **Preferred path:** Neon-managed hosted backups for each separate production database, with a documented restore owner.
- **Fallback path:** Render-scheduled logical `pg_dump` backups to encrypted off-host object storage.
- **Josh & Tina now:** confirm the live lane, confirm the preferred path, add fallback only if needed, and run a restore drill.
- **Democratic Party later:** do not launch without a fully separate database lane, backup lane, restore owner, and successful restore drill.
