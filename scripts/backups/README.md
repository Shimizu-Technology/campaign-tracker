# Postgres backup toolkit

Shell helpers for creating and restoring compressed PostgreSQL backups for Campaign Tracker deployments.

## Files

- `backup_postgres.sh` — create a timestamped `.sql.gz` dump from `DATABASE_URL`
- `restore_postgres.sh` — restore a `.sql` or `.sql.gz` dump into `TARGET_DATABASE_URL`

## Prerequisites

- `pg_dump`
- `psql`
- `gzip`
- `shasum` (optional, for checksum output)

## Create a backup

```bash
export DATABASE_URL="postgresql://..."
export BACKUP_PREFIX="campaign_tracker_prod"
./scripts/backups/backup_postgres.sh
```

Optional environment variables:

- `BACKUP_OUTPUT_DIR` — default output directory (defaults to `./backups`)
- `BACKUP_PREFIX` — filename prefix (defaults to `postgres_backup`)

Useful flags:

- `--output-dir ./tmp/backups`
- `--prefix campaign_tracker_josh_tina`
- `--no-checksum`
- `--dry-run`

Example output:

- `./backups/campaign_tracker_prod_20260421_000000.sql.gz`
- `./backups/campaign_tracker_prod_20260421_000000.sql.gz.sha256`

## Restore a backup

Dry run first:

```bash
export TARGET_DATABASE_URL="postgresql://..."
./scripts/backups/restore_postgres.sh ./backups/campaign_tracker_prod_20260421_000000.sql.gz --dry-run
```

Real restore requires `--force`:

```bash
export TARGET_DATABASE_URL="postgresql://..."
./scripts/backups/restore_postgres.sh ./backups/campaign_tracker_prod_20260421_000000.sql.gz --force
```

Or pass the target explicitly:

```bash
./scripts/backups/restore_postgres.sh \
  --target-url "postgresql://..." \
  ./backups/campaign_tracker_prod_20260421_000000.sql.gz \
  --force
```

## Notes

- Scripts are plain Bash with `set -euo pipefail`.
- Connection URLs are parsed into PostgreSQL `PG*` environment variables so the full URL is not passed to `pg_dump` or `psql` as a positional argument.
- Backups are written to a temporary file first, then moved into place after success.
- Backups use `pg_dump --clean --if-exists --no-owner --no-privileges` so restores are more portable across Neon/Postgres environments.
- Always verify the target database before running a restore with `--force`.
