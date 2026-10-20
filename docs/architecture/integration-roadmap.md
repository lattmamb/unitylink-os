# UnityLink Repository Integration Roadmap

## Strategy
Integrate existing projects incrementally around UnityLink OS. Do not bulk-merge forks or run multiple overlapping agent platforms. Each phase leaves the current system usable and has measurable exit criteria.

## Phase 0 — Inventory and provenance
- Enumerate all repositories: visibility, fork status/parent, default branch, last push, license, project IDs, languages, manifests, tests and deployment.
- Compare candidates by Git trees and commit ancestry, not names.
- Record exact upstream commit and local divergence for each fork.
- Scan for secrets and licensing constraints without exposing secret values.

Deliverable: machine-readable repository catalog and a decision report. Exit when each repo is classified as core, integration candidate, runtime, UI, reference, duplicate/snapshot or archive candidate; unknowns are explicit.

## Phase 1 — Contracts and source-of-truth baseline
- Adopt the module manifest and command/result envelopes in module-contract.md.
- Inventory current UnityLink routes, schemas, RBAC, audit events and Paperclip bridge behavior.
- Declare the owner for each domain entity and financial record.
- Keep the current read-only Paperclip bridge read-only until a write contract and approval model are tested.

Exit: no module can write canonical booking, payment, vehicle or evidence state except through its owning service.

## Phase 2 — One vertical slice
Build and verify mobility.audit-booking:
1. Read booking, vehicle availability and evidence through UnityLink APIs.
2. Validate required fields and state consistency.
3. Produce findings with evidence references.
4. Require operator approval for any mutation.
5. Write only through the authoritative UnityLink endpoint.
6. Verify persisted state and append audit evidence.

Exit: tests cover valid, invalid, unauthorized, duplicate, unavailable, timeout and approval-required cases. No mock success is accepted.

## Phase 3 — Paperclip adapter
- Map UnityLink capability IDs to Paperclip tasks/agent assignments.
- Pass only a manifest, scoped inputs and canonical record references.
- Return result envelopes and evidence references to task history.
- Preserve budgets, cancellation, retry and approval gates.
- Pin the fork and document upstream comparison/upgrade.

Exit: a Paperclip task invokes a capability and cannot bypass UnityLink server authorization.

## Phase 4 — Runtime adapters
Evaluate one runtime at a time against the same capability suite. Keep one known-good path while testing another. Measure correctness, policy compliance, time, cost, retries, recovery, evidence quality and repeatability.

Exit: outputs are independent of transcript formatting; runtime switching does not change business data semantics.

## Phase 5 — Product/UI integration
Compare aether-ride-vision, blitz-rides, Unity-APP, unity2 and other mobility candidates. Extract useful interactions behind UnityLink APIs; avoid duplicate booking/pricing logic.

Exit: customer and operator UIs share canonical availability, pricing, booking and payment state; no fake success paths remain.

## Phase 6 — Specialist adapters
Only after the vertical slice works, consider model gateways, browser automation, local inference, CRM/ERP and battery/energy integrations. Each must solve a measured need and pass the module contract.

## Release gates
- Tests, typecheck, lint and build pass.
- Auth/RBAC tests pass; unauthorized writes fail closed.
- Idempotency and timeout recovery tested.
- Audit events and evidence references persist.
- No secret in frontend bundle, logs or packed repository context.
- Deployment, rollback and backup procedures documented.
- No public claim that a proposed integration is live.

## Current boundary
This roadmap does not itself connect external runtimes or modify production data. It defines the safe sequence for making those connections in reviewable increments.
