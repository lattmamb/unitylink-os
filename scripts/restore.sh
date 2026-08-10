#!/usr/bin/env bash
# UnityLink OS — restore wrapper.
#
# Restores the evidence vault from a backup archive, verifying every file's
# SHA-256 against the backup manifest before writing anything into place.
# See docs/ops/incident-response.md for the restore runbook.
#
# Usage:
#   scripts/restore.sh --backup data/backups/unitylink-backup-*.tar.gz [--db PATH] [--vault DIR]
#
# Exit codes: 0 = restored, 1 = failure (checksum mismatch or missing archive).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${UNITYLINK_DB:-$ROOT/data/evidence.db}"
VAULT="${UNITYLINK_VAULT_DIR:-$ROOT/data/vault}"
BACKUP=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup) BACKUP="$2"; shift 2 ;;
    --db) DB="$2"; shift 2 ;;
    --vault) VAULT="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$BACKUP" ]]; then
  echo "Usage: scripts/restore.sh --backup <archive> [--db PATH] [--vault DIR]" >&2
  exit 2
fi

node "$ROOT/scripts/lib/backup.mjs" restore --backup "$BACKUP" --db "$DB" --vault "$VAULT"