# UnityLink Module Contract

Status: proposed v1. Implement and version contracts before production writes.

## 1. Module manifest
Every module publishes a manifest with: schema version, module ID, name, kind (domain/capability/runtime/connector/interface), version, owner, status, entrypoints, inputs, outputs, permissions, data authority, subscribed/published events, health check, tests, source repository/ref, and license review.

Statuses: proposed, under-review, ready, active, degraded, retired. A manifest alone does not make a module active.

## 2. Command and result envelopes

Command envelope fields:
- schema_version
- command_id
- idempotency_key
- capability_id
- requested_by
- correlation_id
- requested_at
- input
- approval requirement and decision reference

Result envelope fields:
- schema_version and matching command_id
- status: succeeded, failed, blocked, or needs_review
- start/completion timestamps
- outputs, evidence references, changes, errors
- verification checks passed and failed

These are proposed shapes. Map them to existing typed API models before production use. Additive optional fields are backward-compatible; removing/renaming required fields requires a major version and migration.

## 3. State ownership
- UnityLink domain APIs own fleet, booking, subscription, incident, maintenance and operational finance state.
- Evidence vault owns evidence metadata, content hashes, source references, approval records and export/version history.
- Paperclip owns orchestration objects: agents, assignments, goals, task execution history and orchestration budgets.
- Payment processor owns its transaction lifecycle; UnityLink stores reconciled processor references and ledger entries.
- UI clients own transient presentation state only.
- Agent memory is contextual assistance, not canonical records or evidence.

If two systems need the same concept, declare one master and a derived projection. Never allow silent bidirectional writes.

## 4. Execution lifecycle
1. Validate manifest, module version and inputs.
2. Authenticate actor and enforce server-side authorization.
3. Check idempotency key and current entity state.
4. Evaluate approval policy before consequential writes.
5. Execute with least privilege and bounded time/resource budget.
6. Persist result, evidence references, audit event and correlation ID.
7. Verify postconditions against canonical state.
8. Return explicit status; errors and uncertainty are not success.
9. Support safe retry or compensation where applicable.

## 5. Event contract
Every event includes event ID, schema version, event type, occurred/recorded timestamps, actor ID, entity type/ID, correlation ID, source module, payload and evidence references. Consumers tolerate duplicate delivery, preserve ordering where required and record failures. Do not put secrets or unnecessary personal data in events.

## 6. Capability folder convention
Each capability uses:
- TASK.md: intent, preconditions, steps, stop conditions
- input.schema.json and output.schema.json
- permissions.yml: minimum access
- acceptance.md: observable success/failure checks
- examples/: sanitized examples only

Instructions describe what a worker should do. Enforcement belongs in APIs, tool grants, filesystem permissions, approval checks and validation code—not prose alone.

## 7. Versioning and compatibility
Pin external repositories by commit/release. Record upstream remote, fork base, local patch set and last-reviewed date. Test adapters against contract fixtures, not another module's internals. Keep adapters thin and replaceable. Require migration notes for schema changes. A module is ready only after contract tests, security checks and operational ownership are documented.
