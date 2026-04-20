#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: restore_postgres.sh [options] BACKUP_FILE

Restore a PostgreSQL backup into TARGET_DATABASE_URL.

Options:
  --target-url URL    Target PostgreSQL connection string (default: TARGET_DATABASE_URL)
  --force             Required for a real restore
  --dry-run           Print the commands without running them
  -h, --help          Show this help text

Arguments:
  BACKUP_FILE         Path to a .sql or .sql.gz backup file

Environment:
  TARGET_DATABASE_URL Target PostgreSQL connection string when --target-url is not provided

Examples:
  TARGET_DATABASE_URL="$TARGET_DATABASE_URL" ./scripts/backups/restore_postgres.sh ./backups/campaign_tracker_prod_20260420_230000.sql.gz --dry-run
  ./scripts/backups/restore_postgres.sh --target-url "$TARGET_DATABASE_URL" ./backups/campaign_tracker_prod_20260420_230000.sql.gz --force
EOF
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: required command not found: $cmd" >&2
    exit 1
  fi
}

log() {
  printf '%s\n' "$*"
}

set_pg_env_from_url() {
  local database_url="$1"
  local parsed

  parsed="$(DATABASE_URL="$database_url" python3 <<'PY'
import os
from urllib.parse import parse_qs, unquote, urlparse

url = os.environ["DATABASE_URL"]
parsed = urlparse(url)

if parsed.scheme not in ("postgres", "postgresql"):
    raise SystemExit(f"Unsupported database URL scheme: {parsed.scheme or 'missing'}")

if not parsed.path or parsed.path == "/":
    raise SystemExit("Database URL must include a database name")

values = {
    "PGHOST": unquote(parsed.hostname or ""),
    "PGPORT": str(parsed.port or ""),
    "PGDATABASE": unquote(parsed.path.lstrip("/")),
    "PGUSER": unquote(parsed.username or ""),
    "PGPASSWORD": unquote(parsed.password or ""),
    "PGSSLMODE": "",
}

query = parse_qs(parsed.query, keep_blank_values=True)
if "sslmode" in query and query["sslmode"]:
    values["PGSSLMODE"] = query["sslmode"][-1]

for key, value in values.items():
    print(f"{key}\t{value}")
PY
)"

  while IFS=$'\t' read -r key value; do
    [[ -n "$key" ]] || continue
    export "$key=$value"
  done <<< "$parsed"
}

TARGET_URL="${TARGET_DATABASE_URL:-}"
DRY_RUN="false"
FORCE="false"
BACKUP_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-url)
      [[ $# -ge 2 ]] || { echo "Error: --target-url requires a value" >&2; exit 1; }
      TARGET_URL="$2"
      shift 2
      ;;
    --force)
      FORCE="true"
      shift
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -* )
      echo "Error: unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      if [[ -n "$BACKUP_FILE" ]]; then
        echo "Error: only one backup file may be provided" >&2
        usage >&2
        exit 1
      fi
      BACKUP_FILE="$1"
      shift
      ;;
  esac
done

[[ -n "$BACKUP_FILE" ]] || { echo "Error: BACKUP_FILE is required" >&2; usage >&2; exit 1; }
[[ -n "$TARGET_URL" ]] || { echo "Error: TARGET_DATABASE_URL must be set or provided with --target-url" >&2; exit 1; }

case "$BACKUP_FILE" in
  *.sql|*.sql.gz) ;;
  *)
    echo "Error: backup file must end with .sql or .sql.gz" >&2
    exit 1
    ;;
esac

if [[ "$DRY_RUN" != "true" && "$FORCE" != "true" ]]; then
  echo "Error: refusing to restore without --force" >&2
  exit 1
fi

if [[ "$DRY_RUN" != "true" ]]; then
  [[ -f "$BACKUP_FILE" ]] || { echo "Error: backup file not found: $BACKUP_FILE" >&2; exit 1; }
  require_command psql
  case "$BACKUP_FILE" in
    *.sql.gz)
      require_command gzip
      ;;
  esac
fi
require_command python3

set_pg_env_from_url "$TARGET_URL"

log "Restoring PostgreSQL backup"
log "Backup file: ${BACKUP_FILE}"

if [[ "$DRY_RUN" == "true" ]]; then
  log "[dry-run] PostgreSQL connection variables prepared from TARGET_DATABASE_URL"
  case "$BACKUP_FILE" in
    *.sql.gz)
      log "[dry-run] gzip -dc \"${BACKUP_FILE}\" | psql"
      ;;
    *.sql)
      log "[dry-run] psql < \"${BACKUP_FILE}\""
      ;;
  esac
  exit 0
fi

case "$BACKUP_FILE" in
  *.sql.gz)
    gzip -dc "$BACKUP_FILE" | psql
    ;;
  *.sql)
    psql < "$BACKUP_FILE"
    ;;
esac

log "Restore complete: ${BACKUP_FILE}"
