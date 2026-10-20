# UnityLink Capabilities

A capability is a versioned, testable procedure—not a separately maintained agent personality. Compatible runtimes execute the same capability using approved tools and canonical UnityLink APIs.

## Required structure
Each capability folder contains TASK.md (intent, preconditions, steps, stop conditions), input.schema.json, output.schema.json, permissions.yml, acceptance.md and sanitized examples.

## First capability targets
1. engineering.repository-audit — inventory repository metadata, parent/fork ancestry, languages, manifests, tests and security signals; produce evidence-backed keep/integrate/reference/archive recommendations.
2. mobility.audit-booking — verify booking, vehicle availability, pricing, payment reference and approval status without inventing success.
3. finance.reconcile-ledger — reconcile source transactions against canonical ledger entries; separate cash, revenue, debt principal, interest, deposits and depreciation.
4. engineering.validate-release — run required checks, record commit/ref and test evidence, and block release on failures.

## Rules
- Capability instructions never grant permissions by themselves.
- Consequential mutations go through authenticated APIs with server-side authorization.
- Each run records input references, capability version, runtime, result, evidence and correlation ID.
- A failed or ambiguous operation returns failed, blocked or needs_review, never fabricated success.
- Examples contain synthetic or sanitized data only.
