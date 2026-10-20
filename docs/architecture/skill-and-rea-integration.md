# UnityLink Skill, Agent and REA Integration Baseline

Status: proposed architecture; no new skill or agent installation is implied. Validate each skill source, license, runtime, and permission scope before adoption.

## Objective

Use Paperclip as the work coordinator, UnityLink OS as the canonical domain/evidence framework, portable skills as reusable procedures, and REA as an evidence-producing reverse-engineering/investigation capability. Do not equate available skill with installed, enabled, or safe to execute.

## 1. Responsibility boundaries

- **UnityLink OS**: canonical business records, evidence records, identity/authorization policy, approvals, module registry, capability contracts, audit trail.
- **Paperclip**: task assignment, dependencies, agent work history, goals and budgets. It must not become the canonical vehicle, subscription, or finance ledger.
- **Skills**: versioned procedures and decision criteria. A skill is not an autonomous service and should not hold secrets or bypass authorization.
- **Agent runtimes**: execute skills and return structured results. Multiple runtimes may implement the same contract; only one system owns a given queue/state.
- **REA**: inspect code/application behavior through MCP/CLI and return findings with evidence and limitations. It is an investigation tool, not an instruction authority or automatic code merger.
- **Tests/evaluation**: verify claims, permissions, output schemas, regressions, and measurable value before promotion.

## 2. Skill classes to inventory

Create a complete inventory from actual repositories and connected agent environments. Do not assume the names below refer to a specific installed artifact until the exact source is found.

| Requested family | Intended role | Integration rule |
|---|---|---|
| Superpowers | Brainstorming, planning, TDD, systematic debugging, review, verification | Use as workflow guidance; preserve human approval gates and evidence-based completion |
| REA / reverse-engineer-anything | Source and application investigation, architecture discovery, evidence-backed findings | Run locally/in an isolated environment; inspect only software the operator owns or is authorized to analyze |
| ECC / headroom | Not yet identified precisely from the provided name | Resolve canonical repository, version, exact skill names, license, and scope before adopting |
| Context-mode | Context selection/compaction or context workflow, if this is the intended project | Verify exact upstream and behavior; never silently discard evidence or provenance |
| Interpreted-context methodology | User-named methodology; exact source and definition not yet established | Treat as a proposed protocol until source text and acceptance criteria are recorded |
| Consciousness-principles skill | User-named skill; exact source and claims not yet established | Translate into observable behavior rules; do not treat anthropomorphic claims as verified system capabilities |
| Other forked agent skills | Reusable specialized procedures | Index source, version, dependencies, tool grants, inputs/outputs, tests, and provenance |

## 3. Canonical skill manifest

Every adopted skill must have a record with:
- stable ID and human-readable name;
- source repository, path, exact commit SHA/tag, license;
- purpose and non-goals;
- required runtime, model/context requirements, dependencies;
- typed input/output schema and expected artifacts;
- tools/actions it may call and permission scope;
- preconditions, approval checkpoints, stop conditions;
- evidence/provenance requirements;
- test cases, failure cases, known limitations;
- version, owner, status (candidate, reviewed, approved, deprecated).

Example YAML record (the ref is a placeholder, not a verified commit):

    schema_version: '1.0'
    id: 'investigation.repository-audit'
    status: 'candidate'
    source:
      repository: 'morluto/rea'
      path: '.agents/skills'
      ref: 'pin-an-reviewed-commit-before-use'
    purpose: 'Produce evidence-backed architecture and behavior findings.'
    inputs: [repository_url, target_question, authorized_scope]
    outputs: [findings, evidence_refs, limitations, recommended_next_probes]
    permissions:
      filesystem: 'read-only allowlist'
      network: 'disabled unless explicitly authorized'
      code_execution: 'disabled for untrusted repository content'
    approval:
      before_external_write: true
      before_install_or_config_change: true
    verification:
      require_source_locations: true
      require_independent_tests_for_code_changes: true

## 4. Paperclip work orchestration contract

Each Paperclip task should carry:
- task_id, parent_task_id, goal, acceptance_criteria;
- canonical UnityLink entity IDs (if applicable);
- allowed repositories/paths and pinned commit refs;
- selected skill IDs and versions;
- allowed tools, read/write scope, time/cost budget;
- expected output schema and evidence requirements;
- dependency IDs, timeout, retry/idempotency policy;
- approval required for writes, installs, deployments, customer contact, financial or vehicle actions;
- final status and links to evidence, test results, and code diffs.

Suggested lifecycle: proposed → scoped → approved → running → evidence_review → verified → accepted.

Failure/stop states: blocked, failed, rejected, cancelled. Never auto-transition from running to accepted based solely on an agent's self-report.

## 5. REA investigation workflow

1. Identify the target repository and pinned commit; confirm ownership/authorization and license.
2. Define one question and the smallest sufficient analysis scope.
3. Check REA prerequisites and actual connected MCP tool schemas; do not infer availability from package name alone.
4. Run read-only analysis; do not execute target code by default.
5. Capture evidence, source locations, dependency relationships, limits, and confidence.
6. Compare findings with direct source review and tests.
7. Propose a bounded change; do not apply it automatically.
8. If approved, create a branch, add tests, implement, run verification, inspect diff, and submit for review.
9. Save the report as UnityLink evidence, including target commit and REA/tool version.

REA upstream documents local analysis, agent setup, CLI/MCP workflows, and evidence/limitations. Its setup instructions call for reviewing proposed changes and approving them; use that pattern for UnityLink integrations as well.

## 6. Context and headroom policy

Context budget is a managed resource, not a reason to lose source truth.
- Keep a compact task brief with objective, constraints, current state, decisions, open questions, and source references.
- Keep full evidence in durable files or UnityLink evidence records; pass references instead of repeatedly pasting whole repositories.
- Never replace source evidence with an untraceable summary.
- Mark statements as established, inferred, assumed, or unresolved.
- Preserve negative findings and uncertainty.
- Before compaction or handoff, write a checkpoint: work completed, files/commits changed, tests actually run, blockers, next action.
- Record context/token budgets and truncation risks only where measured by the runtime; do not invent available headroom.

## 7. Promotion gates

A skill or agent can move from candidate to approved only after:
1. source and license verified;
2. exact version pinned;
3. capabilities and tool permissions documented;
4. secrets and untrusted content isolated;
5. input/output schema tested;
6. negative/failure cases tested;
7. evidence and audit record verified;
8. incremental value measured against current baseline;
9. rollback/removal path documented;
10. a human approves any consequential write capability.

## 8. First vertical slice

Build one read-only repository intelligence workflow:
- Paperclip coordinates a repository audit task.
- UnityLink supplies the authorization scope and canonical task/evidence IDs.
- A pinned REA skill performs targeted investigation through the available MCP/CLI interface.
- A portable UnityLink skill defines the report schema and acceptance criteria.
- The result includes source refs, architecture map, dependency/license/security observations, uncertainty, and recommended disposition.
- A verifier checks schema and evidence links; a human accepts or rejects the report.
- No automatic code edits, package installation, external writes, deployments, customer communication, or fleet actions.

This demonstrates interoperability before broader agent access is granted.