# Democratic Party Deployment Readiness

Last updated: 2026-04-23

## Bottom line

The Democratic Party deployment is **not production-ready** unless it has its **own separate production data lane**.

That means all of the following must be true:
- a separate Neon production database exists for Democratic Party data
- the Democratic Party backup path is documented
- the Democratic Party restore owner is named
- the Democratic Party restore path has been tested

If those items are missing, readiness is **not** met.

## Non-negotiable separation rule

> Democratic Party cannot be called production-ready if it shares the Josh & Tina production database or backup chain.

Separate frontend or backend deploys are not enough by themselves.
The **database lane** and the **backup lane** must also be separate.

## What this repo confirms vs. does not confirm

Confirmed from this repo:
- Campaign Tracker is documented around the **Josh & Tina** campaign context.
- Production architecture is documented as **Render + Netlify + Neon**.

Not confirmed from this repo:
- that a separate Democratic Party production database already exists
- that Democratic Party Neon hosted backups are already enabled
- that a Democratic Party fallback `pg_dump` backup job already exists
- that Democratic Party restore ownership is already assigned
- that a Democratic Party restore drill has already passed

Because those items are not confirmed here, Democratic Party should currently be treated as **not yet ready for production data**.

## Required backup posture for Democratic Party

### Preferred path

The preferred path is:

> **Use Neon-managed hosted backups for the separate Democratic Party production database, with a named restore owner.**

Required outcome:
- Democratic Party has its **own Neon production database**
- Neon-managed backup / restore capability is confirmed for that database
- actual retention on the selected plan is recorded
- one person is named as restore owner

### Fallback path

If the preferred path is unavailable or insufficient, the fallback path is:

> **Run scheduled `pg_dump` backups from Render and store them in encrypted off-host object storage.**

Required outcome:
- the logical backup job is scheduled
- dumps are retained in encrypted storage away from the live database host
- retention is recorded
- one person is named to monitor job success and backup freshness

## Readiness checklist

### Separate lane
- [ ] Separate Neon production database exists for Democratic Party data
- [ ] Democratic Party does **not** share the Josh & Tina production database
- [ ] Democratic Party uses separate production secrets
- [ ] Democratic Party Render deployment is wired to the Democratic Party database
- [ ] Democratic Party Netlify deployment is wired to the correct Democratic Party environment

### Backup posture
- [ ] Preferred path confirmed: Neon-managed hosted backup / restore is enabled for Democratic Party
- [ ] Actual retention window is recorded
- [ ] Restore owner is named
- [ ] Secrets owner is named
- [ ] If needed, fallback path is in place: Render-scheduled `pg_dump` to encrypted off-host object storage
- [ ] Backup monitoring / freshness owner is named

### Restore proof
- [ ] Restore drill completed against the Democratic Party lane
- [ ] Restore happened into a **new non-production database copy**
- [ ] Restored data was validated before any production cutover decision
- [ ] Date, operator, timing, and result were recorded

## Launch gate

Democratic Party is blocked from production launch until all of the following are true:
- the production database is separate from Josh & Tina
- the backup path is separate from Josh & Tina
- restore ownership is explicit
- a restore drill has passed

## Sign-off artifact required

Before anyone says this lane is ready, there should be a one-page sign-off note or ticket comment that states:
- Democratic Party database name
- Democratic Party Render service name
- Democratic Party Netlify site name
- backup method in use
- actual retention window
- restore owner
- secrets owner
- last restore drill date and result

If one of those items is missing, the lane is not ready for client handoff or launch language.

## Leon approval questions

Leon only needs to answer these yes/no questions:

1. Yes / No: Democratic Party must have its **own separate production database**.
2. Yes / No: Democratic Party must use **Neon-managed hosted backups** as the preferred backup path.
3. Yes / No: If needed, Democratic Party may use **Render-scheduled `pg_dump` backups to encrypted off-host object storage** as the fallback path.
4. Yes / No: Democratic Party may not launch until a **named restore owner** is assigned.
5. Yes / No: Democratic Party may not launch until a **restore drill passes**.
