#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/restore-dev-db.sh [dump-file]

Dumps the current public schema from the local dev database container, then
restores the supplied SQL dump into that same database.

Defaults:
  container: energenius-award-db-dev
  dump file: ./award_system_db_25_05_2026.sql
  backup dir: ./db-backups

Environment overrides:
  CONTAINER_NAME       Database container name
  DB_USER              Database user
  DB_NAME              Database name
  BACKUP_DIR           Directory for the pre-restore dump
  CONFIRM_RESTORE=1    Skip the confirmation prompt
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

CONTAINER_NAME="${CONTAINER_NAME:-energenius-award-db-dev}"
DUMP_FILE="${1:-${DUMP_FILE:-$ROOT_DIR/award_system_db_25_05_2026.sql}}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/db-backups}"
SCHEMA_NAME="public"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required but was not found in PATH." >&2
  exit 1
fi

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "Dump file not found: $DUMP_FILE" >&2
  exit 1
fi

if ! docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  echo "Container '$CONTAINER_NAME' was not found." >&2
  echo "Start the dev stack with: docker compose -f docker-compose.dev.yml up -d" >&2
  exit 1
fi

if [[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME")" != "true" ]]; then
  echo "Container '$CONTAINER_NAME' is not running." >&2
  echo "Start it with: docker compose -f docker-compose.dev.yml up -d db" >&2
  exit 1
fi

DB_USER="${DB_USER:-$(docker exec "$CONTAINER_NAME" printenv POSTGRES_USER 2>/dev/null || true)}"
DB_NAME="${DB_NAME:-$(docker exec "$CONTAINER_NAME" printenv POSTGRES_DB 2>/dev/null || true)}"
DB_USER="${DB_USER:-award}"
DB_NAME="${DB_NAME:-award}"

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${SCHEMA_NAME}_${TIMESTAMP}.sql"

echo "Container: $CONTAINER_NAME"
echo "Database:  $DB_NAME"
echo "User:      $DB_USER"
echo "Backup:    $BACKUP_FILE"
echo "Restore:   $DUMP_FILE"
echo

if [[ "${CONFIRM_RESTORE:-}" != "1" ]]; then
  read -r -p "This will drop and restore schema '$SCHEMA_NAME'. Continue? [y/N] " answer
  case "$answer" in
    [yY] | [yY][eE][sS]) ;;
    *)
      echo "Canceled."
      exit 0
      ;;
  esac
fi

mkdir -p "$BACKUP_DIR"

echo "Dumping current '$SCHEMA_NAME' schema..."
docker exec "$CONTAINER_NAME" pg_dump \
  --username "$DB_USER" \
  --dbname "$DB_NAME" \
  --schema "$SCHEMA_NAME" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  >"$BACKUP_FILE"

echo "Preparing '$SCHEMA_NAME' schema for restore..."
docker exec -i "$CONTAINER_NAME" psql \
  --username "$DB_USER" \
  --dbname "$DB_NAME" \
  --set ON_ERROR_STOP=on <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    CREATE ROLE postgres;
  END IF;
END
$$;

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
SQL

echo "Restoring dump..."
docker exec -i "$CONTAINER_NAME" psql \
  --username "$DB_USER" \
  --dbname "$DB_NAME" \
  --set ON_ERROR_STOP=on \
  <"$DUMP_FILE"

echo
echo "Done. Previous public schema dump saved to: $BACKUP_FILE"
