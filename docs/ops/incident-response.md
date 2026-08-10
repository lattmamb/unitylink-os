# UnityLink OS — Incident Response

Operational runbook for the UnityLink OS production-like deployment. Every
incident must end with a dated record (this doc or an issue comment) so the
pilot keeps an audit trail. This document is evidence for the UNI-8 production
hardening work; review and extend it as the deployment evolves.

Status: **active** (2026-08-09). Owned by: Founding Engineer. Escalation:
Chief of staff → board.

## Severity levels

| Sev | Name | Example | First responder | Target |
|-----|------|---------|-----------------|--------|
| SEV-1 | Outage / data loss | Vault API down, backups failing, evidence unrecoverable | Founding Engineer immediately | Restore within 1 hour |
| SEV-2 | Degraded | Control-plane dashboard stale, monitor alerts, one API unhealthy | Founding Engineer same day | Fix within 1 business day |
| SEV-3 | Minor | Log noise, cosmetic defect, low-risk config drift | Founding Engineer on next heartbeat | Next release |
| SEV-4 | Security suspicion | Possible leaked key, unauthorized access, secret in diff | Founding Engineer immediately; escalate to CEO before any other action | Contain within 1 hour |

## Roles

- **Incident commander** — Founding Engineer (default). Coordinates, owns the
  issue/comment trail, decides severity, declares resolution.
- **Escalation owner** — Chief of staff. Approves SEV-1/SEV-4 actions that
  cross cost or governance boundaries.
- **Board** — final authority for security, legal, financial, or destructive
  changes. Never bypass the human approval gate on gated actions.

## Communication

- Every incident gets a comment on the tracked issue (or a new issue when the
  incident has no home) with: timestamp, severity, symptom, owner, action.
- Use `#incident` tags / issue labels so the audit export captures it.
- Never post secrets, tokens, or customer data into comments or logs.

## Detection (monitoring)

- `scripts/monitor.mjs` polls each `MONITOR_URLS` health endpoint every N
  seconds (default 30) and logs JSON status lines; exits non-zero on failure
  so a supervisor (cron/launchd/supervisor) can page/restart.
- Health endpoints: `/api/health` (public), `/api/control-plane/health` (public).
- On SEV-2+ the operator confirms via `curl` before declaring an incident.

## Response procedure

1. **Acknowledge** — note the alert, check the service, post a comment with
   severity and owner within 15 minutes for SEV-1/SEV-4.
2. **Assess** — capture logs (`*.log`, JSON stdout), check disk, check
   `scripts/monitor.mjs` output, check the last successful backup.
3. **Contain** — for SEV-4 (secret/security): stop the service, rotate the key,
   then escalate to CEO. For data corruption: stop writes to the vault API.
4. **Restore** (see runbook below).
5. **Resolve** — verify health endpoints return 200, verify a restore test
   passes, close the incident comment with the timeline.
6. **Postmortem** — small record: what happened, why, what changed, what is
   scheduled to prevent recurrence. File it as an issue or this doc's appendix.

## Restore runbook (tested)

Backups are created with `scripts/backup.sh` and restored with
`scripts/restore.sh`. The end-to-end restore test lives in
`scripts/test/backup-restore.test.mjs` and runs in CI; it seeds a DB, backs it
up, destroys the originals, restores, and verifies checksums + row counts.

```bash
# 1. List available backups (newest first)
node scripts/lib/backup.mjs list --out data/backups

# 2. Stop writes to the vault (stop the vault API process)

# 3. Restore from the newest archive (verifies SHA-256 against the manifest)
./scripts/restore.sh --backup data/backups/unitylink-backup-<TIMESTAMP>.tar.gz

# 4. Verify
curl -s http://127.0.0.1:8788/api/health
node --test scripts/test/backup-restore.test.mjs   # CI also runs this

# 5. Restart the vault API and confirm evidence rows are present
```

A failed checksum aborts the restore before anything is written; originals are
left untouched.

## Backup schedule

- **Daily**: `scripts/backup.sh` via cron/launchd at 02:00 local (or the
  platform scheduler) into `data/backups/`. Each run produces a tar.gz +
  SHA-256 manifest.
- **Retention**: keep 14 daily backups, 8 weekly. Prune with a cron job.
- **Off-site**: copy `data/backups/` to a second location (e.g. cloud object
  store) once the pilot has one; until then record the copy destination on the
  backup issue.

## Secret management

- `.env` is gitignored; `.env.example` documents every variable. Secrets live
  in the deployment environment / secret manager, never in the repo.
- `scripts/secret-scan.sh` runs in CI and fails the build on secret patterns.
- Key rotation: rotate `UNITYLINK_OPERATOR_KEY` and `PAPERCLIP_API_KEY`
  immediately on any suspected leak (SEV-4). `openssl rand -hex 32` for new keys.

## Appendix — incident log

| Date (UTC) | Sev | Summary | Owner | Resolution |
|------------|-----|---------|-------|------------|
| — | — | (append entries here) | — | — |
