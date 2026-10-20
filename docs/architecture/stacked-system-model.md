# UnityLink Stacked System Model

Status: architecture proposal based on repository metadata, sampled README/source files, and the current UnityLink OS tree. This is not proof that candidate repositories are secure, maintained, or production-ready.

## The design rule

UnityLink is one governed system with many replaceable implementations. Repositories are source material, not automatically runtime dependencies. Integrate a capability only when it has a defined contract, a clear owner, a testable contribution, and a safe failure mode.

## Layer stack

```text
L0  GOVERNANCE + IDENTITY
    permissions, approval policy, secrets, audit, budgets, provenance
                         |
L1  CANONICAL DOMAIN + EVIDENCE
    UnityLink OS: vehicles, bookings, subscriptions, evidence, decisions,
    operational records, source citations, audit events
                         |
L2  ORCHESTRATION
    Paperclip: task assignment, goals, agent lifecycle, budgets, work history
                         |
L3  CAPABILITY CONTRACTS
    versioned instruction files + input/output schemas + permission manifests
                         |
L4  EXECUTION ADAPTERS
    one selected agent runtime, model gateway, browser/computer tools, MCP
                         |
L5  DOMAIN SERVICES
    mobility, booking, dispatch, fleet analytics, billing, CRM/ERP, energy
                         |
L6  EXPERIENCES
    customer app, operator console, finance/evidence UI, mobile/desktop views
                         |
L7  OBSERVABILITY + LEARNING LOOP
    tests, traces, metrics, evaluations, evidence-backed outcomes, regression
```

The layers are logical boundaries, not a requirement to run eight separate servers. Keep the smallest practical deployment; separate processes only where isolation, scaling, ownership, or reliability justify it.

## What each layer may own

| Layer | Owns | Must not own |
|---|---|---|
| Governance | identity, role policy, approval rules, secret boundaries, audit requirements | business records duplicated in each tool |
| Canonical domain | authoritative fleet, booking, subscription, evidence and operational state | agent scheduling or model-specific prompt state |
| Orchestration | task assignment, dependencies, goals, budget, retries and work history | authoritative vehicle/payment/evidence facts |
| Capability | procedure, typed inputs/outputs, preconditions, permitted tools, acceptance tests | credentials or undocumented side effects |
| Execution | running a capability and returning a structured result | bypassing authorization or silently changing canonical state |
| Domain service | a bounded specialist function behind a stable API | a competing source of truth for the same entity |
| Experience | user interaction and presentation | fake operational truth or unapproved writes |
| Observability | evidence of execution, quality, latency, cost, failures and drift | replacing source records with summaries |

## Repository families and proposed disposition

### A. Keep as the core

- `lattmamb/unitylink-os` — canonical application, evidence vault, fleet/mobility domain, approval and audit surfaces. Existing source tree already separates control-plane, evidence-vault, and fleet-mobility services.
- `lattmamb/paperclip` — orchestration candidate behind the current read-only bridge. Keep task coordination here; do not make it the canonical mobility or finance database.

### B. Combine as customer-facing product material

- `aether-ride-vision`, `blitz-rides` — compare as one UI lineage before selecting components. README samples point to the same Lovable project ID; treat as possible variants, not two independent products.
- `Unity-APP`, `unity2`, `boltuni` — compare as another UI lineage; README samples point to a shared Lovable project ID. Reuse the strongest routes/components after a file-level diff and UX review.
- `fleetly-autonomous-navi`, `RideVision` — candidates for navigation, vehicle/telemetry views and fleet analytics; only expose data through UnityLink contracts.

Do not combine whole frontends blindly. Extract reusable components and flows, then connect them to one canonical API and identity model.

### C. Select one implementation per capability

- Agent orchestration/runtime: Paperclip is the proposed coordinator; benchmark `agent-zero`, `suna`, `agent-gpt`, `crewAI`, `PraisonAI`, `OpenManus`, `SuperAGI`, and `smolagents` as alternatives or specialized workers. Do not let multiple frameworks independently own the same task queue.
- Browser/computer interaction: evaluate `browser-ai`, `nanobrowser`, `Web-Agent`, and `mcp-server-macos-use` behind one narrow tool contract. Browser actions must be sandboxed, domain-restricted, logged, and approval-gated for consequential actions.
- Model routing/inference: `litellm`, `open-webui`, `anything-llm`, `text-generation-webui`, and `self-llm` are options, not a stack to install wholesale. Pick based on privacy, provider coverage, local hardware, latency and cost.
- Tool protocol: `servers`, `mcp-containers`, and `aci` are connector/tool-infrastructure candidates; verify authentication, isolation, scopes and logging before enabling.
- Repository intelligence: `repomix` can prepare scoped context for code review; exclude secrets and private user data.
- CRM/ERP: `twenty`, `odoo`, and `metasfresh` are bounded integration candidates only. Do not let them create duplicate customer, invoice or ledger authorities.
- Billing: `nextjs-subscription-payments` is a reference for extracting payment/subscription patterns, not proof of a production billing integration.
- Persistence/auth: `supabase` is an architecture option, not a repository to merge wholesale. Decide whether/when to migrate from the current SQLite-backed services; define a single authoritative data model first.
- UI foundations: `expo`, `three.js`, `dioxus`, `onlook` and related frameworks are dependencies/tooling candidates, not business modules to copy into the monorepo.
- Energy/hardware: `Battery-Emulator` is isolated research until hardware scope, safety boundaries and a tested adapter are established.
- Research collections: `GenAI_Agents`, `awesome-llm-apps`, `awesome-nocode-lowcode`, `system-prompts-and-models-of-ai-tools`, and similar catalogs are discovery inputs, not runtime dependencies.

## Compounding combinations

| Composition | Why the combination compounds | Required seam |
|---|---|---|
| Evidence vault + orchestration + capability contracts | Every task can carry source evidence, approvals, outputs and reproducible history | task ID, evidence IDs, provenance and status contract |
| Fleet domain + customer UI + booking capability | UI becomes a real operating product rather than a prototype with isolated mock state | versioned vehicle/availability/booking APIs |
| Model gateway + replaceable runtimes + evaluation harness | Swap models/runtimes without rewriting the business process; compare quality and cost | common capability input/output schema and scorecard |
| Browser/MCP tools + least-privilege policy + audit | External systems become accessible without handing each agent unrestricted control | scoped tool manifest, allowlists, approval checkpoints |
| Billing patterns + canonical subscription ledger + evidence | Payment events can reconcile to subscriptions and auditable business facts | idempotent webhooks, immutable event IDs, reconciliation tests |
| CRM/ERP + canonical customer and finance IDs | Customer support and finance can share context without duplicating authority | stable external IDs, sync direction and conflict rules |
| Repository index + tests + provenance | Useful code can be selected by measured value rather than repository count or README claims | source commit, license, tests, dependency and delta report |

## First vertical slice

Implement one safe, observable end-to-end path before connecting every repository:

1. An operator creates a repository-audit task in UnityLink.
2. Paperclip coordinates the task through its existing read-only integration; task writes remain in the orchestration system until a governed write API is designed.
3. A repository-audit capability receives an allowlisted repository URL, target question, permitted scope and expected output schema.
4. A sandboxed worker reads metadata and selected source files; it does not execute untrusted repository code.
5. The worker returns a structured report with claims, exact source paths/commit SHAs, license and dependency notes, risks, confidence, and proposed disposition.
6. UnityLink stores the report as evidence with provenance and a content hash; an operator reviews and accepts/rejects it.
7. Tests verify authorization, scope limits, missing repository, API failure, malformed output, secret redaction and immutable audit history.

This slice should be read-only. It proves the seams before any agent can modify code, deploy software, move money, contact customers, or change fleet operations.

## Integration gates

A candidate may advance only after:
- upstream/fork ancestry and local delta are recorded;
- license and dependency obligations are checked;
- source has been reviewed (not just the README);
- security and data-flow boundaries are documented;
- the adapter has typed contracts and tests;
- failure, retry, idempotency and audit behavior are demonstrated;
- a measurable advantage over the existing implementation is shown.

## Next decision order

1. Establish the repository catalog and lineage/delta facts.
2. Diff the two UI lineages and identify the best reusable customer flows.
3. Implement the read-only repository-audit capability and evidence output.
4. Connect the chosen mobility UI to the existing fleet API, removing duplicate/mock state.
5. Add specialist runtimes/tools only when a benchmark proves incremental value.
6. Consider write-capable integrations only after authorization, approvals and reconciliation tests pass.
