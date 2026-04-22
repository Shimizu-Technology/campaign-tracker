# Render backup cron setup

## What this covers
This is the Render-side scheduler pattern for the current production stack: **Render app + Neon Postgres**.
It creates a dedicated Render cron service that runs `./scripts/backups/backup_postgres.sh` once per day.

> Dependency note: the backup/restore scripts are added in **PR #116**. Merge PR #116 before using this blueprint, or merge both PRs together and deploy in that order.

## Current limitation
PR #116 creates a local `.sql.gz` dump only. It does **not** upload that dump to S3/R2/B2 or any other off-host destination.
Because Render cron jobs write to ephemeral filesystem space, this PR by itself is **not sufficient to claim production-ready backups**.
Treat it as a scheduling blueprint plus verification checklist until an off-host copy/retention step exists.

## Files in this PR
- `render.backups.yaml` — example Render blueprint for the cron service
- `api/.env.backups.example` — minimum environment variables for backup + restore verification
- `docs/ops/render-backup-cron-setup.md` — this runbook

## Step-by-step
1. Merge **PR #116** so these scripts exist on the target branch:
   - `scripts/backups/backup_postgres.sh`
   - `scripts/backups/restore_postgres.sh`
2. Review `render.backups.yaml` and confirm service name, branch, schedule, and filename placeholders.
   - The example intentionally uses `branch: staging` for this PR. Before any production promotion, make a deliberate branch decision so the cron job does **not** accidentally keep running from staging when it should run from `main`.
3. In Render, create a **Cron Job** using the values from `render.backups.yaml`.
   - The example starts on the **starter** plan because it is the cheapest explicit option for initial setup.
   - If manual test runs or scheduled runs start timing out, or if the production dump size grows enough that the job no longer finishes comfortably, upgrade the cron service to **standard** before relying on it for backup generation.
4. Add the required secret manually in the Render dashboard:
   - `DATABASE_URL`
5. Set the non-secret vars from `api/.env.backups.example`:
   - `BACKUP_OUTPUT_DIR`
   - `BACKUP_PREFIX`
6. Run the cron job manually once in Render and confirm in the logs:
   - the job exits successfully
   - the dump path is written under the expected `/tmp/...` output directory
   - the filename uses the expected prefix and timestamp format
7. Perform a restore drill before calling the backup flow usable:
   - provision a disposable verification database
   - set `TARGET_DATABASE_URL` locally for that disposable database
   - use `./scripts/backups/restore_postgres.sh <backup-file> --dry-run`
   - then run the real restore against the disposable database with `--force`
   - verify the restored database opens correctly before discarding it
8. Do **not** treat the Render cron job as a production backup until dumps are copied to an approved off-host destination with retention.

## Democratic Party note
The Democratic Party deployment should **not** share the Campaign Tracker production database or backup destination.
It should get:
- its **own Neon database**
- its **own Render cron job**
- its **own backup naming/path conventions**
- the **same restore-drill requirement** as this runbook

## Jerry can do
- Prepare the Render cron blueprint and env example
- Create the cron job in Render using approved values
- Enter non-production placeholders for review
- Run the first manual backup job and capture the log output
- Run the restore drill against a disposable database after a real dump exists
- Copy this setup for a separate Democratic Party database once that database exists

## Needs Leon approval
- Whether this branch should merge now as documentation/guardrails even though off-host upload is still missing
- Final off-host storage provider/account choice for real retained backups
- Production credentials/secrets entry
- Whether the Democratic Party deployment is provisioned now or later
- Any cost-bearing infra changes in Render, Neon, or storage
- Whether backup reliability now requires moving the cron service from **starter** to **standard**

## Production-ready prerequisites
Before calling this backup flow production-ready, all of the following should be true:
1. **PR #116** is merged on the branch the cron job runs from.
2. The Render cron job has completed at least one successful manual run.
3. A restore drill has succeeded against a disposable verification database.
4. Dumps are copied off Render's ephemeral filesystem to an approved retained destination.
5. Ownership, retention window, and failure monitoring are documented in ops notes.

## Merge order
1. **PR #116** — backup and restore scripts
2. **This PR** — Render cron blueprint + env example + setup doc
3. **Follow-up** — off-host upload/retention implementation before production reliance

If both PRs are merged close together, make sure the target branch contains PR #116 before the first Render cron run.

## Plan sizing note
- Start with **starter** only if the current production dump finishes cleanly during the first manual run with comfortable headroom.
- Move to **standard** if the dump is large, the job is close to Render's starter execution limits, or you want more safety margin before treating the backup generation job as reliable.
- Re-test immediately after any plan change so the expected runtime is documented.
