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
    -*)
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
[[ -f "$BACKUP_FILE" ]] || { echo "Error: backup file not found: $BACKUP_FILE" >&2; exit 1; }

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
  require_command psql
  case "$BACKUP_FILE" in
    *.sql.gz)
      require_command gzip
      ;;
  esac
fi

log "Restoring PostgreSQL backup"
log "Backup file: ${BACKUP_FILE}"

if [[ "$DRY_RUN" == "true" ]]; then
  log "[dry-run] Target database URL is set"
  case "$BACKUP_FILE" in
    *.sql.gz)
      log "[dry-run] gzip -dc \"${BACKUP_FILE}\" | psql \"TARGET_DATABASE_URL\""
      ;;
    *.sql)
      log "[dry-run] psql \"TARGET_DATABASE_URL\" < \"${BACKUP_FILE}\""
      ;;
  esac
  exit 0
fi

case "$BACKUP_FILE" in
  *.sql.gz)
    gzip -dc "$BACKUP_FILE" | psql "$TARGET_URL"
    ;;
  *.sql)
    psql "$TARGET_URL" < "$BACKUP_FILE"
    ;;
esac

log "Restore complete: ${BACKUP_FILE}"
