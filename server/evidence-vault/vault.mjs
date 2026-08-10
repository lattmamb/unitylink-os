/**
 * UnityLink OS — evidence vault service.
 *
 * File vault with SHA-256 content addressing, source citations,
 * provenance/audit history, human-approval gates for gated actions,
 * and exportable audit reports.
 *
 * Zero runtime dependencies: node:sqlite, node:crypto, node:fs, node:http.
 * Runs on Node >= 22.6.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { audit, newId, nowIso, sha256Hex } from "./db.mjs";

export class VaultError extends Error {}
export class ApprovalError extends Error {}

/* ------------------------------------------------------------------ */
/* Evidence items (file vault)                                        */
/* ------------------------------------------------------------------ */

function mapEvidence(row) {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    description: row.description,
    fileName: row.file_name,
    sha256: row.sha256,
    vaultPath: row.vault_path,
    tags: row.tags ? JSON.parse(row.tags) : [],
    status: row.status,
    source: row.source,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Upload an evidence document to the vault. Content is stored in a
 * content-addressed directory (sha256 of the content). The database
 * records metadata only — never the raw content.
 */
export function addEvidence(db, actor, input) {
  if (!input.title.trim()) throw new VaultError("Title is required");
  if (!input.content || input.content.length === 0) throw new VaultError("Content is required");

  const sha256 = sha256Hex(input.content.toString("utf8"));
  const vaultDir = input.vaultDir ?? "./vault";
  const hashDir = join(vaultDir, sha256.slice(0, 2), sha256.slice(2, 4));
  const filePath = join(hashDir, sha256);

  // Content-addressed storage: only write if not already present.
  if (!existsSync(filePath)) {
    mkdirSync(hashDir, { recursive: true });
    writeFileSync(filePath, input.content);
  }

  const id = newId();
  db.prepare(
    `INSERT INTO evidence_items
       (id, title, kind, description, file_name, sha256, vault_path, tags, source, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.title.trim(),
    input.kind.trim(),
    input.description ?? null,
    input.fileName ?? null,
    sha256,
    filePath,
    input.tags?.length ? JSON.stringify(input.tags) : null,
    input.source ?? "upload",
    actor,
  );

  audit(db, {
    entityType: "evidence_item",
    entityId: id,
    action: "evidence.add",
    actor,
    reason: "File vault upload with SHA-256 content addressing",
    detail: JSON.stringify({ title: input.title, kind: input.kind, sha256, fileName: input.fileName ?? null }),
  });

  return mapEvidence(db.prepare("SELECT * FROM evidence_items WHERE id = ?").get(id));
}

export function listEvidence(db, opts = {}) {
  const where = [];
  const params = [];
  if (opts.kind) { where.push("kind = ?"); params.push(opts.kind); }
  if (opts.status) { where.push("status = ?"); params.push(opts.status); }
  const sql = `SELECT * FROM evidence_items ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
  return db.prepare(sql).all(...params).map(mapEvidence);
}

export function getEvidence(db, id) {
  const row = db.prepare("SELECT * FROM evidence_items WHERE id = ?").get(id);
  if (!row) throw new VaultError("Evidence item not found");
  return mapEvidence(row);
}

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

function mapSource(row) {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    url: row.url,
    citation: row.citation,
    authority: row.authority,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function addSource(db, actor, input) {
  if (!input.title.trim()) throw new VaultError("Title is required");
  const id = newId();
  db.prepare(
    `INSERT INTO sources (id, title, kind, url, citation, authority, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.title.trim(), input.kind.trim(), input.url ?? null, input.citation ?? null, input.authority ?? null, input.notes ?? null);

  audit(db, {
    entityType: "source",
    entityId: id,
    action: "source.add",
    actor,
    detail: JSON.stringify({ title: input.title, kind: input.kind }),
  });
  return mapSource(db.prepare("SELECT * FROM sources WHERE id = ?").get(id));
}

export function listSources(db) {
  return db.prepare("SELECT * FROM sources ORDER BY created_at DESC").all().map(mapSource);
}

/* ------------------------------------------------------------------ */
/* Citations                                                           */
/* ------------------------------------------------------------------ */

export function addCitation(db, actor, evidenceId, sourceId, note) {
  const id = newId();
  db.prepare(
    `INSERT INTO citations (id, evidence_id, source_id, note) VALUES (?, ?, ?, ?)`,
  ).run(id, evidenceId, sourceId, note ?? null);

  audit(db, {
    entityType: "citation",
    entityId: id,
    action: "citation.add",
    actor,
    detail: JSON.stringify({ evidenceId, sourceId }),
  });
  return db.prepare("SELECT * FROM citations WHERE id = ?").get(id);
}

export function listCitations(db, evidenceId) {
  const rows = evidenceId
    ? db.prepare("SELECT * FROM citations WHERE evidence_id = ? ORDER BY created_at DESC").all(evidenceId)
    : db.prepare("SELECT * FROM citations ORDER BY created_at DESC").all();
  return rows;
}

/* ------------------------------------------------------------------ */
/* Human-approval gates                                                */
/* ------------------------------------------------------------------ */

const GATED_ACTIONS = new Set(["contract", "payment", "legal_conclusion", "external_submission", "destructive_change"]);

function mapApproval(row) {
  return {
    id: row.id,
    actionType: row.action_type,
    title: row.title,
    description: row.description,
    status: row.status,
    requestedBy: row.requested_by,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    decisionNote: row.decision_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Request human approval for a gated action. Gated action types:
 * contract, payment, legal_conclusion, external_submission, destructive_change.
 */
export function requestApproval(db, actor, input) {
  if (!GATED_ACTIONS.has(input.actionType)) {
    throw new VaultError(`Action type "${input.actionType}" is not gated; no approval required`);
  }
  if (!input.title.trim()) throw new VaultError("Title is required");

  const id = newId();
  db.prepare(
    `INSERT INTO approval_requests (id, action_type, title, description, requested_by)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, input.actionType, input.title.trim(), input.description ?? null, actor);

  audit(db, {
    entityType: "approval_request",
    entityId: id,
    action: "approval.request",
    actor,
    reason: `Gated action "${input.actionType}" requires human approval`,
    detail: JSON.stringify({ title: input.title }),
  });
  return mapApproval(db.prepare("SELECT * FROM approval_requests WHERE id = ?").get(id));
}

/**
 * Decide on an approval request. Only `approve` or `block` are valid.
 * Gated execution refuses unless approved.
 */
export function decideApproval(db, actor, approvalId, decision, note) {
  const row = db.prepare("SELECT * FROM approval_requests WHERE id = ?").get(approvalId);
  if (!row) throw new VaultError("Approval request not found");
  if (row.status !== "pending") throw new VaultError(`Approval already ${row.status}`);

  db.prepare(
    `UPDATE approval_requests SET status = ?, decided_by = ?, decided_at = ?, decision_note = COALESCE(?, decision_note), updated_at = ?
     WHERE id = ?`,
  ).run(decision === "approve" ? "approved" : "blocked", actor, nowIso(), note ?? null, nowIso(), approvalId);

  audit(db, {
    entityType: "approval_request",
    entityId: approvalId,
    action: `approval.${decision}`,
    actor,
    reason: decision === "approve" ? "Human approval granted" : "Human approval blocked",
    detail: note ?? null,
  });
  return mapApproval(db.prepare("SELECT * FROM approval_requests WHERE id = ?").get(approvalId));
}

/**
 * Execute a gated action. Refuses unless the approval request is approved.
 */
export function executeGatedAction(db, actor, approvalId, input) {
  const approval = db.prepare("SELECT * FROM approval_requests WHERE id = ?").get(approvalId);
  if (!approval) throw new VaultError("Approval request not found");
  if (approval.status !== "approved") {
    throw new ApprovalError(`Cannot execute: approval is "${approval.status}" (must be "approved")`);
  }

  audit(db, {
    entityType: "gated_action",
    entityId: approvalId,
    action: "gated_action.execute",
    actor,
    reason: `Executed gated action "${approval.action_type}" after human approval`,
    detail: JSON.stringify({ description: input.description ?? null, title: approval.title }),
  });
  return { approvalId, actionType: approval.action_type, executed: true, executedAt: nowIso() };
}

export function listApprovals(db, status) {
  const rows = status
    ? db.prepare("SELECT * FROM approval_requests WHERE status = ? ORDER BY created_at DESC").all(status)
    : db.prepare("SELECT * FROM approval_requests ORDER BY created_at DESC").all();
  return rows.map(mapApproval);
}

/* ------------------------------------------------------------------ */
/* Finance packet versioning (immutable snapshots)                     */
/* ------------------------------------------------------------------ */

function mapPacket(row) {
  return {
    id: row.id,
    title: row.title,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPacketVersion(row) {
  return {
    id: row.id,
    packetId: row.packet_id,
    version: row.version,
    sha256: row.sha256,
    parentSha256: row.parent_sha256,
    body: row.body ? JSON.parse(row.body) : null,
    changeSummary: row.change_summary,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function createPacket(db, actor, input) {
  if (!input.title.trim()) throw new VaultError("Title is required");
  const id = newId();
  db.prepare(`INSERT INTO packets (id, title, created_by) VALUES (?, ?, ?)`).run(id, input.title.trim(), actor);

  const body = input.payload ?? {};
  const sha256 = sha256Hex(JSON.stringify(body));
  const versionId = newId();
  db.prepare(
    `INSERT INTO packet_versions (id, packet_id, version, sha256, parent_sha256, body, change_summary, created_by)
     VALUES (?, ?, 1, ?, NULL, ?, ?, ?)`,
  ).run(versionId, id, sha256, JSON.stringify(body), input.changeSummary ?? "Initial version", actor);

  audit(db, {
    entityType: "packet",
    entityId: id,
    action: "packet.create",
    actor,
    detail: JSON.stringify({ title: input.title, version: 1, sha256 }),
  });
  return { packet: mapPacket(db.prepare("SELECT * FROM packets WHERE id = ?").get(id)), version: 1, sha256 };
}

export function addPacketVersion(db, actor, packetId, input) {
  const packet = db.prepare("SELECT * FROM packets WHERE id = ?").get(packetId);
  if (!packet) throw new VaultError("Packet not found");

  const versions = db.prepare("SELECT * FROM packet_versions WHERE packet_id = ? ORDER BY version DESC").all(packetId);
  const latest = versions[0];
  const nextVersion = (latest?.version ?? 0) + 1;
  const body = input.payload ?? {};
  const sha256 = sha256Hex(JSON.stringify(body));
  const versionId = newId();

  db.prepare(
    `INSERT INTO packet_versions (id, packet_id, version, sha256, parent_sha256, body, change_summary, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(versionId, packetId, nextVersion, sha256, latest?.sha256 ?? null, JSON.stringify(body), input.changeSummary ?? `Version ${nextVersion}`, actor);

  db.prepare(`UPDATE packets SET updated_at = ? WHERE id = ?`).run(nowIso(), packetId);

  audit(db, {
    entityType: "packet",
    entityId: packetId,
    action: "packet.version",
    actor,
    detail: JSON.stringify({ version: nextVersion, sha256, parentSha256: latest?.sha256 ?? null }),
  });
  return { packetId, version: nextVersion, sha256, parentSha256: latest?.sha256 ?? null };
}

export function getPacket(db, packetId) {
  const packet = db.prepare("SELECT * FROM packets WHERE id = ?").get(packetId);
  if (!packet) throw new VaultError("Packet not found");
  const versions = db.prepare("SELECT * FROM packet_versions WHERE packet_id = ? ORDER BY version ASC").all(packetId).map(mapPacketVersion);
  return { ...mapPacket(packet), versions };
}

export function getPacketVersion(db, packetId, version) {
  const row = db.prepare("SELECT * FROM packet_versions WHERE packet_id = ? AND version = ?").get(packetId, version);
  if (!row) throw new VaultError("Packet version not found");
  return mapPacketVersion(row);
}

/* ------------------------------------------------------------------ */
/* Audit export                                                        */
/* ------------------------------------------------------------------ */

export function exportAuditJSON(db) {
  const rows = db.prepare(`SELECT * FROM audit_events ORDER BY created_at ASC`).all();
  return {
    exportedAt: nowIso(),
    source: "unitylink-os/evidence-vault",
    auditEvents: rows,
    count: rows.length,
  };
}

export function exportAuditCSV(db) {
  const rows = db.prepare(`SELECT id, entity_type, entity_id, action, actor, role, reason, detail, created_at FROM audit_events ORDER BY created_at ASC`).all();
  const headers = ["id", "entity_type", "entity_id", "action", "actor", "role", "reason", "detail", "created_at"];
  const escape = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.map(escape).join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => escape(r[h])).join(","));
  }
  return lines.join("\n") + "\n";
}

export function exportAuditMarkdown(db) {
  const rows = db.prepare(`SELECT * FROM audit_events ORDER BY created_at ASC`).all();
  const lines = [];
  lines.push("# UnityLink OS — Audit Report");
  lines.push("");
  lines.push(`**Exported at:** ${nowIso()}`);
  lines.push(`**Source:** unitylink-os/evidence-vault`);
  lines.push(`**Events:** ${rows.length}`);
  lines.push("");
  lines.push("| Timestamp | Actor | Action | Entity | Reason | Detail |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of rows) {
    const detail = r.detail ? String(r.detail).replace(/\|/g, "\\|").slice(0, 120) : "";
    lines.push(`| ${r.created_at} | ${r.actor} | ${r.action} | ${r.entity_type} (${r.entity_id.slice(0, 8)}) | ${(r.reason ?? "").replace(/\|/g, "\\|")} | ${detail} |`);
  }
  lines.push("");
  return lines.join("\n");
}