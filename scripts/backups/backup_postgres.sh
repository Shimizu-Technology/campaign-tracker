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

run_cmd() {
  if [[ "$DRY_RUN" == "true" ]]; then
    printf '[dry-run]'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
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

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FILENAME="${PREFIX}_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${OUTPUT_DIR%/}/${FILENAME}"
CHECKSUM_PATH="${BACKUP_PATH}.sha256"

log "Backing up PostgreSQL database"
log "Output file: ${BACKUP_PATH}"

run_cmd mkdir -p "$OUTPUT_DIR"

if [[ "$DRY_RUN" == "true" ]]; then
  log "[dry-run] DATABASE_URL is set"
  log "[dry-run] pg_dump --clean --if-exists --no-owner --no-privileges \"DATABASE_URL\" | gzip > \"${BACKUP_PATH}\""
else
  pg_dump --clean --if-exists --no-owner --no-privileges "$DATABASE_URL" | gzip > "$BACKUP_PATH"
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
