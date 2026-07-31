# Hermes-Native UnityLink OS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build UnityLink OS as a full-stack application with Hermes Agent as its primary runtime, Aether Ride Vision as an interaction reference, and the Kimi UnityLink page as the public-platform reference.

**Architecture:** Keep Hermes at `/Users/lattmamb/.hermes/hermes-agent` as the authoritative runtime. Add a typed UnityLink gateway and client inside this repository; expose sessions, streaming events, tools, approvals, files, memory, cron, and project context through native UI components. Keep public marketing, consumer mobility, and authenticated operational workspace surfaces distinct but connected.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind, shadcn/Radix, TanStack Query, Framer Motion, Vitest, Python 3, FastAPI-compatible gateway adapter, Hermes gateway/session APIs.

## Global Constraints

- Preserve all source repositories; implementation stays under `/Users/lattmamb/Projects/unitylink-os`.
- Hermes is the real runtime; do not use simulated AI responses.
- Vision is contextually embedded across every domain screen.
- Use Aether for route memory, command palette, app switching, mobile navigation, booking flows, motion, and dashboard behavior.
- Use the Kimi page for public-platform hierarchy, subscription storytelling, mobile promotion, jobs, and community entry points.
- Use TDD for behavior changes; run tests, type-check, and production build after each task.

---

### Task 1: Establish the Full-Stack Workspace Boundary

**Files:** Create `apps/web/README.md`, `apps/gateway/README.md`, `packages/hermes-client/src/contracts.ts`, `packages/domain-contracts/src/workspace.ts`, their tests; modify `package.json`.

**Interfaces:** Produce `HermesSession`, `HermesEvent`, `ToolExecution`, `ApprovalRequest`, and `WorkspaceContext`; preserve the current Vite app while preparing migration into `apps/web`.

- [ ] Write failing tests for event discrimination and workspace serialization.
- [ ] Run tests and verify failure because contracts do not exist.
- [ ] Add minimum typed contracts and workspace configuration.
- [ ] Run tests, type-check, and production build.
- [ ] Commit as `chore: establish unitylink full-stack workspace`.

### Task 2: Build the Hermes Gateway Adapter

**Files:** Create `apps/gateway/src/server.py`, `apps/gateway/src/hermes_adapter.py`, `apps/gateway/tests/test_hermes_adapter.py`, and `.env.example`.

**Interfaces:** Produce `GET /health`, `POST /sessions`, `POST /sessions/{id}/messages`, and `GET /sessions/{id}/events`; normalize Hermes text, tool, approval, file, error, and completion events.

- [ ] Write failing adapter tests using a fake Hermes transport.
- [ ] Implement health, session creation, message submission, and event streaming.
- [ ] Verify approval-required events remain blocked until explicit approval.
- [ ] Run gateway tests and a local smoke request.
- [ ] Commit as `feat: add hermes gateway adapter`.

### Task 3: Add the Typed Hermes Client and Session State

**Files:** Create `src/lib/hermes/client.ts`, `src/lib/hermes/eventReducer.ts`, `src/lib/hermes/eventReducer.test.ts`, and `src/hooks/useHermesSession.ts`.

**Interfaces:** Consume Task 2 endpoints; produce `sendMessage`, `approveAction`, `cancelRun`, `events`, `messages`, `toolRuns`, and `connectionState`.

- [ ] Write reducer tests for text streaming, tool lifecycle, approval, error, and completion.
- [ ] Run tests and verify failure.
- [ ] Implement the minimum client, reducer, and hook.
- [ ] Dynamically load streaming-only code.
- [ ] Run tests, type-check, and production build.
- [ ] Commit as `feat: add typed hermes session client`.

### Task 4: Replace the Prototype Vision Panel

**Files:** Create focused components under `src/features/vision/`; modify `src/pages/KnowledgeOS.tsx`.

**Interfaces:** Consume `useHermesSession` and active `WorkspaceContext`; produce a persistent collaboration surface shared by all domains.

- [ ] Write component tests for send, streaming, approval, cancellation, and recovery.
- [ ] Implement Aether-inspired interaction patterns without its simulated assistant.
- [ ] Add keyboard focus, reduced motion, mobile drawer, and accessible status announcements.
- [ ] Verify desktop and mobile interaction in the browser.
- [ ] Commit as `feat: embed hermes vision workspace`.

### Task 5: Embed Hermes Across Domain Workflows

**Files:** Create `src/features/context/WorkspaceContextProvider.tsx` and `contextRegistry.ts`; modify Fleet, booking, charging, locations, projects, governance, jobs, and library routes.

**Interfaces:** Produce a stable context envelope with route, selected entity, workspace, user intent, available actions, and approval policy.

- [ ] Write context-registry tests for each domain route.
- [ ] Add contextual actions and selected-record propagation.
- [ ] Verify direct and conversational actions reach the same confirmation state.
- [ ] Run route tests, type-check, build, and browser workflow tests.
- [ ] Commit as `feat: embed hermes across unitylink domains`.

### Task 6: Visual Fidelity and Performance Pass

**Files:** Modify shared design tokens, navigation, Vision components, responsive layout, and Vite chunk configuration; create `docs/qa/hermes-aether-fidelity-ledger.md`.

- [ ] Compare against the approved OS shell, selected Aether components, and Kimi public-platform reference.
- [ ] Record at least five concrete comparisons covering hierarchy, spacing, typography, navigation, motion, and mobile behavior.
- [ ] Lazy-load Spline, physics, Three.js, maps, and other heavy modules by route or activation.
- [ ] Test open OS → resume Hermes session → send message → stream tool event → approve → display result.
- [ ] Run all tests, lint, type-check, build, desktop QA, and mobile QA.
- [ ] Commit as `perf: verify hermes-native unitylink experience`.

## Execution Order

Tasks run sequentially. Each task leaves the application buildable and independently testable. No source repository is deleted, moved, or overwritten.
