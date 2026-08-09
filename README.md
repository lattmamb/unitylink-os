# UnityLink OS

UnityLink OS is the software platform for the UnityLink Commonwealth Pana, Illinois
pilot — an integrated rural infrastructure operating system combining electric
mobility, community solar and storage, EV charging, workforce pathways, public
finance, and a governed software platform.

This repository is the application monorepo: a web/desktop/mobile-accessible
frontend, the Paperclip control-plane bridge, and the engineering foundation
(CI, lint, tests, previews) the pilot depends on.

> Status: **early scaffold**. This repo builds, lints, and tests green, and ships
> a minimal running app skeleton. Domain workflows (intake, fleet, evidence
> vault, approvals) are tracked as separate issues and land incrementally.

## Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│  Browser / desktop / mobile web client                      │
│  React 18 + TypeScript + Vite + Tailwind + shadcn/ui        │
│  Routes: / (landing), /control-plane, /fleet, /booking, …   │
└───────────────┬─────────────────────────────────────────────┘
                │  /api/control-plane/*  (dev proxy → :8787)
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
```

### Layers

| Layer | Location | Notes |
|-------|----------|-------|
| Web app | `src/` | React SPA, responsive (mobile nav + desktop nav), Vite build |
| Control-plane bridge | `server/control-plane.mjs` | Read-only GET proxy to the Paperclip API; token never shipped to the browser |
| Control-plane client | `src/lib/control-plane.ts` | Typed client + status/time helpers used by the dashboard |
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

## Quality gates

```bash
npm run lint        # ESLint (0 errors expected)
npm test            # Vitest unit + component tests
npx tsc --noEmit    # TypeScript typecheck
npm run build       # Production build to dist/
```

CI runs all four on every push to `main` and on pull requests.

## Preview deployment

A production build is served as a preview via `npm run build` + a static
server (e.g. `npm run preview` or `cloudflared tunnel`). The current preview
URL is recorded on the issue that shipped it.

## Roadmap (tracked in Paperclip)

- [UNI-4] Evidence vault and audit history
- [UNI-5] Customer and member intake workflows
- [UNI-8] Production hardening and deployment

## License / provenance

This repository is UnityLink-owned. Third-party dependencies are listed in
`package.json`; see the vision-parity specification for the licensing boundary
analysis of the broader UnityLink product surface.