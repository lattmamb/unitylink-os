# UnityLink OS

UnityLink OS is the software platform for the UnityLink Commonwealth Pana, Illinois
pilot — an integrated rural infrastructure operating system combining electric
mobility, community solar and storage, EV charging, workforce pathways, public
finance, and a governed software platform.

This repository is the application monorepo: a web/desktop/mobile-accessible
frontend, the Paperclip control-plane bridge, and the engineering foundation
(CI, lint, tests, previews) the pilot depends on.

> Status: **hardened pilot**. This repo builds, lints, tests, and typechecks
> green; ships auth + RBAC, tested backups, secret management, structured
> logging, an incident-response runbook, and a monitored production-like
> deployment. Domain workflows (intake, fleet, evidence vault, approvals) are
> tracked as separate issues and land incrementally.

## Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│  Browser / desktop / mobile web client                      │
│  React 18 + TypeScript + Vite + Tailwind + shadcn/ui        │
│  Routes: / (landing), /control-plane, /evidence, /approvals,│
│          /audit, /fleet, /booking, …                        │
└───────────────┬─────────────────────────────────────────────┘
                │  /api/control-plane/*  (dev proxy → :8787)
                │  /api/evidence/*       (dev proxy → :8788)
                │  /api/fleet/*          (dev proxy → :8789)
┌───────────────▼─────────────────────────────────────────────┐
│  server/control-plane.mjs  — read-only Paperclip bridge     │
│  GET-only proxy; operator token stays server-side           │
└───────────────┬─────────────────────────────────────────────┘
                │ HTTPS (Paperclip API)
┌───────────────▼─────────────────────────────────────────────┐
│  Paperclip control plane (company API)                      │
│  companies · agents · goals · projects · issues · approvals │
│  documents · work products · audit history                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  server/evidence-vault/  — evidence & compliance layer      │
│  SQLite + SHA-256 file vault · sources · citations ·        │
│  approval gates · finance packet versioning · audit export  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  server/fleet-mobility/  — fleet & mobility operations      │
│  vehicle registry (VIN/title/lien/insurance) · bookings ·   │
│  subscriptions · dispatch · mileage · inspections ·         │
│  maintenance · charging · incidents · payments ·            │
│  utilization · operating costs · audit export               │
└─────────────────────────────────────────────────────────────┘
```

### Layers

| Layer | Location | Notes |
|-------|----------|-------|
| Web app | `src/` | React SPA, responsive (mobile nav + desktop nav), Vite build |
| Control-plane bridge | `server/control-plane.mjs` | Read-only GET proxy to the Paperclip API; token never shipped to the browser |
| Control-plane client | `src/lib/control-plane.ts` | Typed client + status/time helpers used by the dashboard |
| Evidence vault | `server/evidence-vault/` | SQLite-backed evidence & compliance layer: SHA-256 file vault, sources, citations, approval gates, finance packet versioning, audit export (JSON/CSV/Markdown) |
| Evidence-vault client | `src/lib/evidence-vault.ts` | Typed client for the vault API, used by `/evidence`, `/approvals`, `/audit` pages |
| Fleet & mobility | `server/fleet-mobility/` | SQLite-backed fleet & mobility operations: vehicle registry (VIN, title, lien, insurance), bookings and subscriptions with operator approval gates, dispatch, mileage, inspections, maintenance, charging sessions, incidents, payments, utilization, operating costs, audit export (JSON/CSV/Markdown) |
| Fleet-mobility client | `src/lib/fleet-mobility.ts` | Typed client for the fleet API, used by `/fleet-operations` |
| UI kit | `src/components/ui/` | shadcn/ui components |
| Tests | `src/**/*.test.ts(x)` | Vitest + Testing Library |
| CI | `.github/workflows/ci.yml` | lint → test → typecheck → build on push/PR |

### Design principles

- **Evidence over mock.** No mock data is presented as real. The control-plane
  dashboard renders live Paperclip company data through the bridge.
- **Read-only by default.** The bridge exposes GET endpoints only; write and
  approval flows stay in the Paperclip control plane until a governed write
  path is built and approved.
- **Secrets stay server-side.** `PAPERCLIP_API_KEY` is read by the bridge
  process, never bundled into the frontend.
- **Fail closed.** If no operator key is configured, protected routes return
  503 rather than silently allowing access. A missing/invalid token is 401; a
  valid token with the wrong role is 403.
- **Backups are verified.** Restore refuses to write until the archive's
  SHA-256 manifest matches; a tampered archive leaves the live data untouched.
- **Everything is logged.** One structured JSON line per request (method,
  path, status, duration, actor) — never headers or bodies.

## Repository layout

```
.github/workflows/ci.yml   CI pipeline (lint, test, typecheck, build)
server/control-plane.mjs   Paperclip control-plane bridge (Node, no deps)
src/                       React application
  pages/                   route-level pages (Index, ControlPlane, Fleet, …)
  components/              UI + feature components
  lib/                     typed clients and helpers
  test/setup.ts            Vitest setup (jest-dom matchers)
vitest.config.ts           Test configuration
vite.config.ts             Build/dev configuration
tailwind.config.ts         Tailwind theme
eslint.config.js           ESLint flat config
```

## Prerequisites

- Node.js 20+ (CI uses Node 22)
- npm 10+

## Run locally

```sh
npm install        # install dependencies
npm run dev        # start Vite dev server → http://localhost:8080
```

The dev server proxies `/api/control-plane/*` to the bridge on `:8787`. To
serve live control-plane data you also need the bridge running with a
Paperclip token:

```bash
PAPERCLIP_API_URL=http://127.0.0.1:3100 \
PAPERCLIP_API_KEY=<operator-or-agent-token> \
PAPERCLIP_COMPANY_ID=<company-id> \
node server/control-plane.mjs
```

Without the bridge, the app still runs; the control-plane page shows its
unavailable state rather than fabricated data.

### Evidence vault

The evidence vault runs as a separate zero-dependency Node server on `:8788`.
The dev server proxies `/api/evidence/*` to it (rewritten to `/api/*`).

```bash
EVIDENCE_PORT=8788 \
EVIDENCE_DB=./data/evidence.db \
EVIDENCE_VAULT_DIR=./data/vault \
node server/evidence-vault/api.mjs
```

Endpoints: `/api/health`, `/api/evidence` (POST/GET), `/api/evidence/:id`,
`/api/evidence/:id/provenance`, `/api/sources`, `/api/evidence/:id/citations`,
`/api/approvals`, `/api/approvals/:id/decision`, `/api/actions/execute`,
`/api/packets`, `/api/packets/:id/versions`, `/api/audit/export?format=…`.

Gated action types (`contract`, `payment`, `legal_conclusion`,
`external_submission`, `destructive_change`) refuse execution until a human
approval is recorded. Every mutation writes an `audit_events` row; the audit
trail exports as JSON, CSV, or Markdown. Run the server tests with:

```bash
node --test "server/evidence-vault/test/*.test.mjs"
```

### Fleet & mobility operations

The fleet & mobility layer runs as a separate zero-dependency Node server on
`:8789`. The dev server proxies `/api/fleet/*` to it (rewritten to `/api/*`).

```bash
FLEET_PORT=8789 \
FLEET_DB=./data/fleet.db \
node server/fleet-mobility/api.mjs
```

Endpoints: `/api/health`, `/api/vehicles` (POST/GET), `/api/vehicles/:id`,
`/api/vehicles/:id/status`, `/api/vehicles/:id/summary`, `/api/vehicles/:id/mileage`,
`/api/vehicles/:id/inspections`, `/api/vehicles/:id/maintenance`,
`/api/vehicles/:id/charging`, `/api/vehicles/:id/incidents`,
`/api/vehicles/:id/costs`, `/api/bookings` (+ decision/schedule/start/complete/cancel),
`/api/subscriptions` (+ decision/activate/cancel), `/api/dispatch`,
`/api/payments`, `/api/audit/export?format=…`.

Booking and subscription requests start `pending` and refuse to proceed past
approval until a human operator decides them (`approve`/`block`). Every
mutation writes an `audit_events` row. Run the server tests with:

```bash
node --test "server/fleet-mobility/test/*.test.mjs"
```

## Quality gates

```bash
npm run lint        # ESLint (0 errors expected)
npm test            # Vitest unit + component tests
npx tsc --noEmit    # TypeScript typecheck
npm run build       # Production build to dist/
./scripts/secret-scan.sh   # fail on committed secrets (sk_live_*, etc.)
node --test server/lib/auth.test.mjs server/evidence-vault/test/*.test.mjs scripts/test/backup-restore.test.mjs
```

CI runs all of the above on every push to `main` and on pull requests.

## Production hardening (UNI-8)

### Auth & RBAC

`server/lib/auth.mjs` implements bearer-token auth with two roles:
`operator` (full data access) and `member` (reserved for the
participant-facing surface). Keys are generated server-side
(`openssl rand -hex 32`), configured via `UNITYLINK_OPERATOR_KEY` /
`UNITYLINK_MEMBER_KEY`, and never committed. Protected routes return 401
(no/invalid token), 403 (wrong role), or 503 (no keys configured — fail
closed). Health endpoints stay public for monitoring.

The SPA signs in at `/login` (`src/pages/Login.tsx`); the token is stored in
`localStorage` and sent as `Authorization: Bearer` on every API call
(`src/lib/auth.ts`).

### Production server

`server/production.mjs` serves the built SPA from `dist/` and proxies
`/api/evidence/*`, `/api/control-plane/*`, and optionally `/api/fleet/*`
(when `FLEET_UPSTREAM` is set). Public aggregate health at `/api/health`.

```bash
npm run build
UNITYLINK_OPERATOR_KEY=<hex> \
PROD_PORT=8080 \
EVIDENCE_UPSTREAM=http://127.0.0.1:8788 \
CONTROL_PLANE_UPSTREAM=http://127.0.0.1:8787 \
node server/production.mjs
```

### Backups & restore

`scripts/backup.sh` / `scripts/restore.sh` wrap the zero-dependency engine in
`scripts/lib/backup.mjs` (system `tar` + SHA-256 manifest). Restore verifies
the manifest before writing anything; a tampered archive is rejected and the
live data is untouched.

```bash
./scripts/backup.sh            # → backups/uni8-<timestamp>.tar.gz
./scripts/restore.sh <archive> # verify manifest, then restore
```

### Secrets

`.env.example` documents every variable with placeholders. `scripts/secret-scan.sh`
fails CI if a real secret pattern (e.g. `sk_live_*`) appears in tracked files.

### Logging & monitoring

`server/lib/log.mjs` emits structured JSON logs (`LOG_LEVEL`, default `info`).
`scripts/monitor.mjs` polls health endpoints and prints one JSON status line
per check; `MONITOR_ONCE=1` exits non-zero on failure for cron/CI use.

```bash
MONITOR_URLS=http://127.0.0.1:8080/api/health,http://127.0.0.1:8788/api/health \
node scripts/monitor.mjs
```

### Incident response

See `docs/ops/incident-response.md` — severity table, response procedure,
restore runbook, backup schedule, and secret-management guidance.

## Preview deployment

A production build is served as a preview via `npm run build` + a static
server (e.g. `npm run preview` or `cloudflared tunnel`). The current preview
URL is recorded on the issue that shipped it.

## Roadmap (tracked in Paperclip)

- [x] [UNI-4] Evidence vault and audit history
- [x] [UNI-6] Fleet & mobility operations (vehicle registry, bookings/subscriptions with operator approval, dispatch, mileage, inspections, maintenance, charging, incidents, payments, utilization, operating costs)
- [ ] [UNI-5] Customer and member intake workflows
- [x] [UNI-8] Production hardening and deployment (auth + RBAC, tested backups, secrets, logging, incident response, monitored deployment)

## License / provenance

This repository is UnityLink-owned. Third-party dependencies are listed in
`package.json`; see the vision-parity specification for the licensing boundary
analysis of the broader UnityLink product surface.