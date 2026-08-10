#!/usr/bin/env node
/**
 * UnityLink OS — evidence vault HTTP API.
 *
 * Operator-facing API for the evidence and compliance layer. All mutations
 * write an append-only audit event; gated actions refuse execution unless a
 * human operator approved them.
 *
 * Endpoints (all JSON; use `X-Operator: <operator-id>` to attribute actions):
 *   POST /api/evidence                    {title, kind, description?, tags[], fileName?, contentBase64}
 *   GET  /api/evidence[?kind=&status=]    list evidence items
 *   GET  /api/evidence/:id                one evidence item
 *   GET  /api/evidence/:id/provenance     audit trail for that item
 *   POST /api/sources                     {title, kind, url?, citation?, authority?, notes?}
 *   GET  /api/sources                     list sources
 *   POST /api/evidence/:id/citations      {sourceId, note?}
 *   GET  /api/evidence/:id/citations      citations for an item
 *   POST /api/approvals                   {actionType, title, description?}
 *   GET  /api/approvals                   ?status=pending|approved|blocked
 *   POST /api/approvals/:id/decision      {decision: "approve"|"block", note?}
 *   POST /api/actions/execute             {approvalId, description?}  (gated)
 *   POST /api/packets                     {title, payload?, changeSummary?}
 *   POST /api/packets/:packetId/versions  {payload?, changeSummary?}
 *   GET  /api/packets/:packetId           packet + version history
 *   GET  /api/packets/:packetId/versions/:version
 *   GET  /api/audit/export?format=json|csv|markdown
 *
 * Env:
 *   EVIDENCE_PORT      (optional, default 8788)
 *   EVIDENCE_DB        (optional, default ./data/evidence.db; ":memory:" for tests)
 *   EVIDENCE_VAULT_DIR (optional, default ./data/vault)
 *   EVIDENCE_CORS      (optional origin allowlist, comma separated; default *)
 *   UNITYLINK_OPERATOR_KEY (required) operator bearer token; all data routes
 *                          are operator-only. /api/health is public.
 *   UNITYLINK_MEMBER_KEY   (optional) member bearer token (reserved for the
 *                          participant-facing surface; denied on vault routes)
 *   LOG_LEVEL          (optional, default info)
 *
 * Run: node server/evidence-vault/api.mjs
 */
import http from "node:http";
import { mkdirSync } from "node:fs";
import { parseArgs } from "node:util";
import { openDb } from "./db.mjs";
import { createAuth, authenticate, requireOperatorWith } from "../lib/auth.mjs";
import { log, requestLogger } from "../lib/log.mjs";
import {
  addEvidence, listEvidence, getEvidence,
  addSource, listSources,
  addCitation, listCitations,
  requestApproval, decideApproval, executeGatedAction, listApprovals,
  createPacket, addPacketVersion, getPacket, getPacketVersion,
  exportAuditJSON, exportAuditCSV, exportAuditMarkdown,
  VaultError, ApprovalError,
} from "./vault.mjs";

const PORT = Number(process.env.EVIDENCE_PORT || 8788);
const DB_PATH = process.env.EVIDENCE_DB || "./data/evidence.db";
const VAULT_DIR = process.env.EVIDENCE_VAULT_DIR || "./data/vault";
const CORS_ALLOW = (process.env.EVIDENCE_CORS || "*").split(",").map((s) => s.trim());

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": CORS_ALLOW.includes("*") ? "*" : CORS_ALLOW[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Operator",
  });
  res.end(payload);
}

function text(res, status, body, contentType) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": CORS_ALLOW.includes("*") ? "*" : CORS_ALLOW[0],
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch {
        reject(new VaultError("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

export function createEvidenceServer(db, opts = {}) {
  const vaultDir = opts.vaultDir ?? VAULT_DIR;
  const auth = opts.auth ?? createAuth();
  if (vaultDir !== ":memory:") mkdirSync(vaultDir, { recursive: true });

  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    let parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "api") parts = parts.slice(1);
    const method = (req.method ?? "GET").toUpperCase();
    const reqLog = requestLogger(req, "evidence-vault");
    const actor = authenticate(req, auth.store)?.id ?? null;

    if (method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": CORS_ALLOW.includes("*") ? "*" : CORS_ALLOW[0],
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Operator",
      });
      res.end();
      reqLog.done(204, actor);
      return;
    }

    try {
      /* ---- health (public) ---- */
      if (method === "GET" && parts.join("/") === "health") {
        reqLog.done(200, actor);
        return json(res, 200, { ok: true, service: "unitylink-os/evidence-vault" });
      }

      /* ---- member self-service (reserved for participant-facing surface) ---- */
      if (method === "GET" && parts.join("/") === "member/me") {
        const denied = requireOperatorWith(auth, req);
        if (denied) {
          reqLog.done(denied.status, actor);
          return json(res, denied.status, denied);
        }
        reqLog.done(200, actor);
        return json(res, 200, { actor: { id: actor, role: "operator" } });
      }

      /* ---- everything below requires operator ---- */
      const denied = requireOperatorWith(auth, req);
      if (denied) {
        reqLog.done(denied.status, actor);
        return json(res, denied.status, denied);
      }

      /* ---- evidence ---- */
      if (method === "POST" && parts.join("/") === "evidence") {
        const body = await readBody(req);
        const content = Buffer.from(body.contentBase64 ?? "", "base64");
        const item = addEvidence(db, actor, {
          title: body.title,
          kind: body.kind ?? "document",
          description: body.description,
          fileName: body.fileName,
          content,
          vaultDir,
          tags: body.tags,
          source: body.source ?? "upload",
        });
        reqLog.done(201, actor);
        return json(res, 201, { evidence: item });
      }

      if (method === "GET" && parts.join("/") === "evidence") {
        const result = {
          evidence: listEvidence(db, {
            kind: url.searchParams.get("kind") ?? undefined,
            status: url.searchParams.get("status") ?? undefined,
          }),
        };
        reqLog.done(200, actor);
        return json(res, 200, result);
      }

      if (method === "GET" && parts.length === 2 && parts[0] === "evidence") {
        reqLog.done(200, actor);
        return json(res, 200, { evidence: getEvidence(db, parts[1]) });
      }

      if (method === "GET" && parts.length === 3 && parts[0] === "evidence" && parts[2] === "provenance") {
        const item = getEvidence(db, parts[1]);
        const events = db.prepare(
          "SELECT * FROM audit_events WHERE entity_id = ? ORDER BY created_at ASC",
        ).all(parts[1]);
        reqLog.done(200, actor);
        return json(res, 200, { evidence: item, provenance: events });
      }

      /* ---- sources ---- */
      if (method === "POST" && parts.join("/") === "sources") {
        const body = await readBody(req);
        const source = addSource(db, actor, {
          title: body.title,
          kind: body.kind ?? "other",
          url: body.url,
          citation: body.citation,
          authority: body.authority,
          notes: body.notes,
        });
        reqLog.done(201, actor);
        return json(res, 201, { source });
      }

      if (method === "GET" && parts.join("/") === "sources") {
        reqLog.done(200, actor);
        return json(res, 200, { sources: listSources(db) });
      }

      /* ---- citations ---- */
      if (method === "POST" && parts.length === 3 && parts[0] === "evidence" && parts[2] === "citations") {
        const body = await readBody(req);
        const citation = addCitation(db, actor, parts[1], body.sourceId, body.note);
        reqLog.done(201, actor);
        return json(res, 201, { citation });
      }

      if (method === "GET" && parts.length === 3 && parts[0] === "evidence" && parts[2] === "citations") {
        reqLog.done(200, actor);
        return json(res, 200, { citations: listCitations(db, parts[1]) });
      }

      /* ---- approvals ---- */
      if (method === "POST" && parts.join("/") === "approvals") {
        const body = await readBody(req);
        const approval = requestApproval(db, actor, {
          actionType: body.actionType,
          title: body.title,
          description: body.description,
        });
        reqLog.done(201, actor);
        return json(res, 201, { approval });
      }

      if (method === "GET" && parts.join("/") === "approvals") {
        const result = {
          approvals: listApprovals(db, url.searchParams.get("status") ?? undefined),
        };
        reqLog.done(200, actor);
        return json(res, 200, result);
      }

      if (method === "POST" && parts.length === 3 && parts[0] === "approvals" && parts[2] === "decision") {
        const body = await readBody(req);
        const approval = decideApproval(db, actor, parts[1], body.decision, body.note);
        reqLog.done(200, actor);
        return json(res, 200, { approval });
      }

      /* ---- gated actions ---- */
      if (method === "POST" && parts.join("/") === "actions/execute") {
        const body = await readBody(req);
        const result = executeGatedAction(db, actor, body.approvalId, { description: body.description });
        reqLog.done(200, actor);
        return json(res, 200, result);
      }

      /* ---- finance packets ---- */
      if (method === "POST" && parts.join("/") === "packets") {
        const body = await readBody(req);
        const result = createPacket(db, actor, {
          title: body.title,
          payload: body.payload,
          changeSummary: body.changeSummary,
        });
        reqLog.done(201, actor);
        return json(res, 201, result);
      }

      if (method === "POST" && parts.length === 3 && parts[0] === "packets" && parts[2] === "versions") {
        const body = await readBody(req);
        const result = addPacketVersion(db, actor, parts[1], {
          payload: body.payload,
          changeSummary: body.changeSummary,
        });
        reqLog.done(201, actor);
        return json(res, 201, result);
      }

      if (method === "GET" && parts.length === 2 && parts[0] === "packets") {
        reqLog.done(200, actor);
        return json(res, 200, { packet: getPacket(db, parts[1]) });
      }

      if (method === "GET" && parts.length === 4 && parts[0] === "packets" && parts[2] === "versions") {
        reqLog.done(200, actor);
        return json(res, 200, { version: getPacketVersion(db, parts[1], Number(parts[3])) });
      }

      /* ---- audit export ---- */
      if (method === "GET" && parts.join("/") === "audit/export") {
        const format = url.searchParams.get("format") ?? "json";
        if (format === "csv") {
          reqLog.done(200, actor);
          return text(res, 200, exportAuditCSV(db), "text/csv; charset=utf-8");
        }
        if (format === "markdown") {
          reqLog.done(200, actor);
          return text(res, 200, exportAuditMarkdown(db), "text/markdown; charset=utf-8");
        }
        reqLog.done(200, actor);
        return json(res, 200, exportAuditJSON(db));
      }

      reqLog.done(404, actor);
      return json(res, 404, { error: "Not found" });
    } catch (err) {
      reqLog.done(err instanceof ApprovalError ? 403 : err instanceof VaultError ? 400 : 500, actor);
      if (err instanceof ApprovalError) return json(res, 403, { error: err.message });
      if (err instanceof VaultError) return json(res, 400, { error: err.message });
      log.error("evidence_vault_error", { error: err.message });
      return json(res, 500, { error: err.message ?? "Internal error" });
    }
  });
}

// Direct execution: node server/evidence-vault/api.mjs --port 8788 --db ./data/evidence.db
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const { values } = parseArgs({
    options: {
      port: { type: "string", default: String(PORT) },
      db: { type: "string", default: DB_PATH },
      "vault-dir": { type: "string", default: VAULT_DIR },
    },
  });
  const dbPath = values.db === ":memory:" ? ":memory:" : values.db;
  if (dbPath !== ":memory:") mkdirSync(dbPath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  const db = openDb(dbPath);
  const auth = createAuth();
  const server = createEvidenceServer(db, { vaultDir: values["vault-dir"], auth });
  const port = Number(values.port);
  server.listen(port, () => {
    log.info("evidence_vault_started", { port, db: dbPath, vaultDir: values["vault-dir"], authConfigured: !auth.disabled });
    if (auth.disabled) {
      log.warn("evidence_vault_auth_disabled", { detail: "Set UNITYLINK_OPERATOR_KEY to protect data routes." });
    }
  });
}