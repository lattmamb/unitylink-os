#!/usr/bin/env bash
# UnityLink OS — secret scanner.
#
# Scans tracked files for common secret patterns (API keys, private keys,
# tokens). Fails (exit 1) when a match is found so CI blocks the commit.
# package-lock.json and node_modules are excluded: lockfiles legitimately
# contain hashes but no secrets; node_modules is never tracked.
#
# Usage: scripts/secret-scan.sh [--all]   (--all also scans untracked files)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FILES="$(git ls-files)"
if [[ "${1:-}" == "--all" ]]; then
  FILES="$(git ls-files --others --exclude-standard; git ls-files)"
fi
# Never scan the scanner itself: its pattern table is a legitimate match target.
FILES="$(printf '%s\n' "$FILES" | grep -v '^scripts/secret-scan.sh$')"

PATTERNS=(
  'AKIA[0-9A-Z]{16}'                       # AWS access key id
  'BEGIN (RSA|EC|OPENSSH|DSA|PGP) PRIVATE KEY'
  'ghp_[A-Za-z0-9]{36}'                    # GitHub PAT
  'github_pat_[A-Za-z0-9_]{22,}'
  'sk-[A-Za-z0-9]{20,}'                    # OpenAI-style keys
  'sk_live_[A-Za-z0-9]{20,}'               # Stripe live keys
  'xox[baprs]-[A-Za-z0-9-]{10,}'           # Slack tokens
  'AIza[0-9A-Za-z_-]{35}'                  # Google API key
  '-----BEGIN PGP PRIVATE KEY'
  'PAPERCLIP_API_KEY\s*=\s*(?!<|change-me-)[^"'"'"' ]{16,}' # leaked env assignment (real value, not placeholder)
  'UNITYLINK_OPERATOR_KEY\s*=\s*(?!<|change-me-)[^"'"'"' ]{16,}'
)

MATCHES=0
for file in $FILES; do
  # Skip binary files and lockfiles.
  case "$file" in
    package-lock.json|pnpm-lock.yaml|bun.lockb|*.png|*.jpg|*.jpeg|*.gif|*.webp|*.ico|*.woff*|*.ttf|*.pdf) continue ;;
  esac
  [[ -f "$file" ]] || continue
  for pat in "${PATTERNS[@]}"; do
    if grep -qE "$pat" "$file" 2>/dev/null; then
      echo "SECRET SCAN FAIL: $file matches pattern: $pat"
      MATCHES=$((MATCHES + 1))
    fi
  done
done

if [[ $MATCHES -gt 0 ]]; then
  echo "Secret scan found $MATCHES potential secret(s). Remove them before committing."
  exit 1
fi

echo "Secret scan clean: no secret patterns in tracked files."
exit 0