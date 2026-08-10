/**
 * UnityLink OS — evidence vault data model (SQLite, zero-dep).
 *
 * Covers: file vault with SHA-256 content addressing, source citations,
 * provenance/audit history, human-approval gates for gated actions
 * (contract, payment, legal_conclusion, external_submission, destructive_change),
 * and exportable audit reports.
 *
 * Everything is written through the service layer or the HTTP/CLI surfaces —
 * never by hand-editing the database.
 */
import { DatabaseSync } from "node:sqlite";
import { randomUUID, createHash } from "node:crypto";

export function openDb(path = ":memory:") {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  return db;
}

export function migrate(db) {
  db.exec(`
  -- Append-only audit trail. Every mutation writes here.
  CREATE TABLE IF NOT EXISTS audit_events (
    id          TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id   TEXT NOT NULL,
    action      TEXT NOT NULL,
    actor       TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'operator',
    reason      TEXT,
    detail      TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Evidence items: file vault with SHA-256 content addressing.
  -- Blobs are stored in a content-addressed vault directory;
  -- only metadata and the hash live in the database.
  CREATE TABLE IF NOT EXISTS evidence_items (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    kind        TEXT NOT NULL CHECK (kind IN ('document','image','video','audio','data','report','contract','receipt','correspondence','other')),
    description TEXT,
    file_name   TEXT,
    sha256      TEXT NOT NULL,
    vault_path  TEXT NOT NULL,
    tags        TEXT,
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','redacted')),
    source      TEXT NOT NULL DEFAULT 'upload',
    created_by  TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Cited sources (statutes, regulations, contracts, websites, correspondence).
  CREATE TABLE IF NOT EXISTS sources (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    kind        TEXT NOT NULL CHECK (kind IN ('statute','regulation','contract','website','correspondence','court_order','policy','other')),
    url         TEXT,
    citation    TEXT,
    authority   TEXT,
    notes       TEXT,
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded','withdrawn')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Citations linking evidence items to sources.
  CREATE TABLE IF NOT EXISTS citations (
    id            TEXT PRIMARY KEY,
    evidence_id   TEXT NOT NULL REFERENCES evidence_items(id),
    source_id     TEXT NOT NULL REFERENCES sources(id),
    note          TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(evidence_id, source_id)
  );

  -- Human-approval gates. Gated action types require an approval
  -- request that a human operator approves or blocks with a note.
  CREATE TABLE IF NOT EXISTS approval_requests (
    id              TEXT PRIMARY KEY,
    action_type     TEXT NOT NULL CHECK (action_type IN ('contract','payment','legal_conclusion','external_submission','destructive_change')),
    title           TEXT NOT NULL,
    description     TEXT,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','blocked')),
    requested_by    TEXT NOT NULL,
    decided_by      TEXT,
    decided_at      TEXT,
    decision_note   TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Finance packet versioning (links to finance-packet module).
  CREATE TABLE IF NOT EXISTS packets (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    created_by  TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS packet_versions (
    id          TEXT PRIMARY KEY,
    packet_id   TEXT NOT NULL REFERENCES packets(id),
    version     INTEGER NOT NULL,
    sha256      TEXT NOT NULL,
    parent_sha256 TEXT,
    body        TEXT NOT NULL,
    change_summary TEXT,
    created_by  TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `);
}

export function nowIso() {
  return new Date().toISOString();
}

export function newId() {
  return randomUUID();
}

export function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

export function audit(db, input) {
  db.prepare(
    `INSERT INTO audit_events (id, entity_type, entity_id, action, actor, role, reason, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId(),
    input.entityType,
    input.entityId,
    input.action,
    input.actor,
    input.role ?? "operator",
    input.reason ?? null,
    input.detail ?? null,
  );
  return true;
}