# Render backup cron setup

## What this covers
This is the backup pattern for the current production stack: **Render app + Neon Postgres**.
It creates a dedicated Render cron service that runs `./scripts/backups/backup_postgres.sh` once per day and ships the dump to object storage.

> Dependency note: the script path above is added in **PR #116**. Merge PR #116 before using this blueprint, or merge both PRs together and deploy in that order.

## Files in this PR
- `render.backups.yaml` — example Render blueprint for the cron service
- `api/.env.backups.example` — minimum environment variables for backup automation
- `docs/ops/render-backup-cron-setup.md` — this runbook

## Step-by-step
1. Merge **PR #116** so `scripts/backups/backup_postgres.sh` exists on the target branch.
2. Review `render.backups.yaml` and confirm service name, branch, schedule, and bucket/prefix placeholders.
3. Create or choose the object-storage destination for backups.
4. In Render, create a **Cron Job** using the values from `render.backups.yaml`.
5. Add secrets manually in the Render dashboard:
   - `DATABASE_URL`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - optional `BACKUP_ALERT_WEBHOOK_URL`
6. Set non-secret vars from `api/.env.backups.example`:
   - `BACKUP_STORAGE_PROVIDER`
   - `BACKUP_BUCKET`
   - `BACKUP_PREFIX`
   - `AWS_REGION`
   - `BACKUP_FILENAME_PREFIX`
   - `BACKUP_RETENTION_DAYS`
7. Run the cron job manually once in Render and confirm:
   - the job exits successfully
   - a dump lands in the expected bucket/prefix
   - the filename includes the expected prefix/date
8. Document the final bucket/prefix and owner in ops notes after approval.

## Democratic Party note
The Democratic Party deployment should **not** share the Campaign Tracker production database or backup path.
It should get:
- its **own Neon database**
- its **own Render cron job**
- its **own storage prefix/bucket path**
- the **same backup pattern** as this runbook

## Jerry can do
- Prepare the Render cron blueprint and env example
- Create the cron job in Render using approved values
- Enter non-production placeholders for review
- Run the first manual backup test
- Verify backup files are being written to the approved destination
- Copy this setup for a separate Democratic Party database once that database exists

## Needs Leon approval
- Final storage provider/account choice
- Real bucket name and retention policy
- Production credentials/secrets entry
- Whether the Democratic Party deployment is provisioned now or later
- Any cost-bearing infra changes in Render, Neon, or storage

## Merge order
1. **PR #116** — backup and restore scripts
2. **This PR** — Render cron blueprint + env example + setup doc

If both PRs are merged close together, make sure the target branch contains PR #116 before the first Render cron run.
