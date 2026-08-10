#!/usr/bin/env bash
# UnityLink OS — daily backup wrapper.
#
# Creates a timestamped, checksummed backup of the evidence vault (SQLite DB +
# content-addressed vault files) into data/backups/. Intended to be run daily
# from cron/launchd; see docs/ops/incident-response.md for the schedule.
#
# Usage:
#   scripts/backup.sh [--db PATH] [--vault DIR] [--out DIR] [--label NAME]
#
# Exit codes: 0 = backup created, 1 = failure (logged to stderr).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${UNITYLINK_DB:-$ROOT/data/evidence.db}"
VAULT="${UNITYLINK_VAULT_DIR:-$ROOT/data/vault}"
OUT="${UNITYLINK_BACKUP_DIR:-$ROOT/data/backups}"
LABEL="unitylink-backup"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db) DB="$2"; shift 2 ;;
    --vault) VAULT="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --label) LABEL="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

node "$ROOT/scripts/lib/backup.mjs" backup \
  --db "$DB" --vault "$VAULT" --out "$OUT" --label "$LABEL"