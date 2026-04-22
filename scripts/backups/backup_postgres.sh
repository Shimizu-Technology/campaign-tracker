#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: backup_postgres.sh [options]

Create a compressed PostgreSQL backup using DATABASE_URL.

Options:
  --output-dir DIR    Directory for backup output (default: BACKUP_OUTPUT_DIR or ./backups)
  --prefix PREFIX     Filename prefix (default: BACKUP_PREFIX or postgres_backup)
  --no-checksum       Skip writing a .sha256 checksum file
  --dry-run           Print the commands without running them
  -h, --help          Show this help text

Environment:
  DATABASE_URL        Source PostgreSQL connection string (required)
  BACKUP_OUTPUT_DIR   Optional default output directory
  BACKUP_PREFIX       Optional default filename prefix

Examples:
  DATABASE_URL="$DATABASE_URL" ./scripts/backups/backup_postgres.sh
  DATABASE_URL="$DATABASE_URL" BACKUP_PREFIX=campaign_tracker_prod ./scripts/backups/backup_postgres.sh --output-dir ./tmp/backups
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

describe_pg_target() {
  local host="${PGHOST:-localhost}"
  local port="${PGPORT:-5432}"
  local database="${PGDATABASE:-unknown}"
  local user="${PGUSER:-unknown}"

  printf '%s@%s:%s/%s' "$user" "$host" "$port" "$database"
}

run_cmd() {
  if [[ "$DRY_RUN" == "true" ]]; then
    printf '[dry-run]'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
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

cleanup_failed_backup() {
  local exit_code=$?

  if [[ $exit_code -ne 0 && "$DRY_RUN" != "true" ]]; then
    [[ -n "${TEMP_BACKUP_PATH:-}" && -f "$TEMP_BACKUP_PATH" ]] && rm -f "$TEMP_BACKUP_PATH"
    [[ -n "${BACKUP_PATH:-}" && -f "$BACKUP_PATH" ]] && rm -f "$BACKUP_PATH"
    [[ -n "${CHECKSUM_PATH:-}" && -f "$CHECKSUM_PATH" ]] && rm -f "$CHECKSUM_PATH"
  fi

  exit "$exit_code"
}

OUTPUT_DIR="${BACKUP_OUTPUT_DIR:-./backups}"
PREFIX="${BACKUP_PREFIX:-postgres_backup}"
WRITE_CHECKSUM="true"
DRY_RUN="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output-dir)
      [[ $# -ge 2 ]] || { echo "Error: --output-dir requires a value" >&2; exit 1; }
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --prefix)
      [[ $# -ge 2 ]] || { echo "Error: --prefix requires a value" >&2; exit 1; }
      PREFIX="$2"
      shift 2
      ;;
    --no-checksum)
      WRITE_CHECKSUM="false"
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
    *)
      echo "Error: unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

: "${DATABASE_URL:?Error: DATABASE_URL must be set}"

if [[ "$DRY_RUN" != "true" ]]; then
  require_command pg_dump
  require_command gzip
fi
require_command python3

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FILENAME="${PREFIX}_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${OUTPUT_DIR%/}/${FILENAME}"
TEMP_BACKUP_PATH="${BACKUP_PATH}.tmp"
CHECKSUM_PATH="${BACKUP_PATH}.sha256"

trap cleanup_failed_backup EXIT

set_pg_env_from_url "$DATABASE_URL"

log "Backing up PostgreSQL database"
log "Source: $(describe_pg_target)"
log "Output file: ${BACKUP_PATH}"

run_cmd mkdir -p "$OUTPUT_DIR"

if [[ "$DRY_RUN" == "true" ]]; then
  log "[dry-run] PostgreSQL connection variables prepared from DATABASE_URL"
  log "[dry-run] pg_dump --clean --if-exists --no-owner --no-privileges | gzip > \"${TEMP_BACKUP_PATH}\" && mv \"${TEMP_BACKUP_PATH}\" \"${BACKUP_PATH}\""
else
  pg_dump --clean --if-exists --no-owner --no-privileges | gzip > "$TEMP_BACKUP_PATH"
  mv "$TEMP_BACKUP_PATH" "$BACKUP_PATH"
fi

if [[ "$WRITE_CHECKSUM" == "true" ]]; then
  if command -v shasum >/dev/null 2>&1; then
    if [[ "$DRY_RUN" == "true" ]]; then
      log "[dry-run] shasum -a 256 \"${BACKUP_PATH}\" > \"${CHECKSUM_PATH}\""
    else
      shasum -a 256 "$BACKUP_PATH" > "$CHECKSUM_PATH"
    fi
    log "Checksum file: ${CHECKSUM_PATH}"
  else
    log "Warning: shasum not found; skipping checksum generation"
  fi
fi

log "Backup complete: ${BACKUP_PATH}"
