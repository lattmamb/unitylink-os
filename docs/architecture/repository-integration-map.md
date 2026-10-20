# UnityLink Modular Repository Integration Map

Status: initial design; source review is partial. This is not a claim that every listed project is already integrated or production-ready.

## Objective
Coordinate existing GitHub projects as interoperable modules under UnityLink without forcing them into one codebase. Preserve useful upstream work, define interfaces, and avoid duplicate sources of truth.

## Authority boundaries

| Concern | Authority | Rule |
|---|---|---|
| Business facts, evidence, fleet records, approvals, operational audit | lattmamb/unitylink-os | Canonical business state. Other modules consume defined APIs/contracts. |
| Agent-team coordination | lattmamb/paperclip | Orchestration, tasks, goals, budgets and task history—not the fleet/finance database. |
| Capability instructions | Versioned files in UnityLink | Procedures, input/output schemas, permissions and acceptance tests. |
| Agent execution | Compatible runtimes such as Hermes, Codex, OpenClaw, Agent Zero | Replaceable workers; never bypass UnityLink authorization. |
| Customer/operator experiences | Selected mobility/UI projects | Use governed APIs; UI mock state is never operational truth. |
| External specialist tools | Browser, repository analysis, model gateway, memory, 3D/device adapters | Narrow interfaces and least-privilege credentials. |

## Repository candidates and disposition

Disposition remains provisional until source-level checks pass.

| Repository | Proposed role | Disposition | Required validation |
|---|---|---|---|
| https://github.com/lattmamb/unitylink-os | Core app, evidence vault, fleet-mobility domain, Paperclip bridge | Canonical core | Keep schemas, audit events and access policy authoritative. |
| https://github.com/lattmamb/paperclip | Agent/task orchestration | API adapter; maintain fork only for necessary deltas | Compare fork with upstream, pin commit, verify permissions, skills, budgets and upgrade path. |
| https://github.com/lattmamb/aether-ride-vision | Mobility UI/booking candidate | Feature donor or UI module | README identifies Lovable project d76e7d47-4679-4596-bf68-1bfffa791dee. Compare routes, booking state, pricing, persistence and accessibility. |
| https://github.com/lattmamb/blitz-rides | Potential duplicate/version of mobility UI | Compare before merge | Earlier README sampling suggested same Lovable project ID as aether-ride-vision; verify tree and commit ancestry. |
| https://github.com/lattmamb/Unity-APP | Customer app candidate | Compare before merge | README identifies Lovable project fa314406-a94b-495f-93d0-93f5073e8084. |
| https://github.com/lattmamb/unity2 | App/UI candidate | Compare before merge | Earlier README sampling suggested same Lovable project ID as Unity-APP; verify actual code overlap. |
| https://github.com/lattmamb/fleetly-autonomous-navi | Navigation/fleet UX candidate | Extract modules after audit | Inspect route model, map provider, privacy, license and contracts. |
| https://github.com/lattmamb/RideVision | Fleet analytics/telemetry candidate | Adapter or reference | Verify real data connectors, credentials, tests and overlap with core fleet domain. |
| https://github.com/lattmamb/agent-zero | General-purpose runtime | Optional execution adapter | Isolate workspace, secrets and tool permissions; benchmark on real capability. |
| https://github.com/lattmamb/suna | General-purpose agent platform | Alternative runtime | Do not deploy alongside other orchestrators by default; measure distinct value. |
| https://github.com/lattmamb/agent-gpt | Autonomous task agent | Reference/optional adapter | Verify maintenance, isolation, tool access and result contract. |
| https://github.com/lattmamb/crewAI ; https://github.com/lattmamb/PraisonAI ; https://github.com/lattmamb/OpenManus ; https://github.com/lattmamb/SuperAGI ; https://github.com/lattmamb/smolagents | Alternative agent frameworks | Benchmark behind one adapter interface | Avoid multiple systems owning the same task queue. |
| https://github.com/lattmamb/repomix | Repository context packaging | Developer/research tool | Check secret exclusions before sharing bundles. |
| https://github.com/lattmamb/litellm | Model provider routing | Optional model adapter | Review credentials, spend limits, fallbacks and security posture. |
| https://github.com/lattmamb/open-webui ; https://github.com/lattmamb/anything-llm ; https://github.com/lattmamb/text-generation-webui ; https://github.com/lattmamb/self-llm | Model/local inference tools | Alternative deployments | Select only if local/private inference is needed; avoid duplicate model management. |
| https://github.com/lattmamb/browser-ai ; https://github.com/lattmamb/nanobrowser ; https://github.com/lattmamb/Web-Agent ; https://github.com/lattmamb/mcp-server-macos-use | Browser/computer interaction | Tool adapters | Sandbox, allowlist domains, confirm consequential actions and prevent data exfiltration. |
| https://github.com/lattmamb/mcp-containers ; https://github.com/lattmamb/servers ; https://github.com/lattmamb/aci | Tool/server infrastructure | Connector candidates | Validate protocol, auth, isolation and observability. |
| https://github.com/lattmamb/nextjs-subscription-payments | Billing integration reference | Extract adapter patterns | Verify processor, webhooks, idempotency, refunds and ledger reconciliation. |
| https://github.com/lattmamb/supabase | Data/auth platform source or fork | Evaluate; do not merge wholesale | Decide whether to keep current SQLite stores or migrate; define one persistence strategy. |
| https://github.com/lattmamb/twenty ; https://github.com/lattmamb/odoo ; https://github.com/lattmamb/metasfresh | CRM/ERP candidates | Bounded integrations only | Do not create parallel customer, invoice or accounting authorities. |
| https://github.com/lattmamb/three.js ; https://github.com/lattmamb/expo ; https://github.com/lattmamb/dioxus ; https://github.com/lattmamb/onlook | UI/platform foundations | Dependencies or references | Prefer packages/components over copying upstream codebases. |
| https://github.com/lattmamb/Battery-Emulator | Battery/energy integration research | Isolated optional adapter | Validate hardware compatibility and safety before equipment connection. |
| https://github.com/lattmamb/GenAI_Agents ; https://github.com/lattmamb/awesome-llm-apps ; https://github.com/lattmamb/awesome-nocode-lowcode ; https://github.com/lattmamb/system-prompts-and-models-of-ai-tools | Research/reference collections | Reference only | Extract licensed, verified patterns into capabilities. |

## Cross-cutting rules
1. One owner for each kind of authoritative state.
2. Modules communicate through versioned APIs, events or file-based capability contracts.
3. Pin each integration to a version/commit and provide rollback.
4. Never infer successful payment, booking, approval or deployment from a timeout, toast or generated identifier.
5. Keep credentials server-side and scoped per adapter.
6. Preserve forks; consolidate through reviewable PRs and adapters.
7. Distinguish verified, proposed, sample/mock and unavailable data.
8. Capability files define procedures; actual permissions are enforced by APIs and tool grants.

## Known gaps
This map is based on UnityLink OS architecture and a partial review of selected READMEs. It is not a complete source, license, dependency, test, secret, fork-ancestry or runtime audit of every repository. Candidate status must not be represented as integration.
