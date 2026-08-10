/**
 * UnityLink OS — evidence vault HTTP API auth enforcement tests.
 *
 * Verifies that data routes require the operator role and that the public
 * health endpoint stays open for monitoring.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../db.mjs";
import { createEvidenceServer } from "../api.mjs";
import { createAuth } from "../../lib/auth.mjs";

const OP_KEY = "test-operator-key-123";
const MEM_KEY = "test-member-key-456";

let server;
let base;
let db;

function listen(srv) {
  return new Promise((resolve) => {
    srv.listen(0, "127.0.0.1", () => resolve(srv.address().port));
  });
}

async function call(path, { method = "GET", token, body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body) headers["content-type"] = "application/json";
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

describe("evidence vault API auth", () => {
  before(async () => {
    db = openDb(":memory:");
    const auth = createAuth({ operatorKey: OP_KEY, memberKey: MEM_KEY });
    server = createEvidenceServer(db, { vaultDir: ":memory:", auth });
    const port = await listen(server);
    base = `http://127.0.0.1:${port}`;
  });

  after(() => {
    server.close();
    db.close();
  });

  test("health is public", async () => {
    const { status, json } = await call("/api/health");
    assert.equal(status, 200);
    assert.equal(json.ok, true);
  });

  test("evidence list requires operator token", async () => {
    const anon = await call("/api/evidence");
    assert.equal(anon.status, 401);
    assert.equal(anon.json.error, "unauthorized");

    const member = await call("/api/evidence", { token: MEM_KEY });
    assert.equal(member.status, 403);
    assert.equal(member.json.error, "forbidden");

    const operator = await call("/api/evidence", { token: OP_KEY });
    assert.equal(operator.status, 200);
  });

  test("evidence upload requires operator token", async () => {
    const anon = await call("/api/evidence", {
      method: "POST",
      body: { title: "x", contentBase64: Buffer.from("x").toString("base64") },
    });
    assert.equal(anon.status, 401);

    const member = await call("/api/evidence", {
      method: "POST",
      token: MEM_KEY,
      body: { title: "x", contentBase64: Buffer.from("x").toString("base64") },
    });
    assert.equal(member.status, 403);

    const operator = await call("/api/evidence", {
      method: "POST",
      token: OP_KEY,
      body: { title: "Auth Test Doc", contentBase64: Buffer.from("auth test").toString("base64") },
    });
    assert.equal(operator.status, 201);
    assert.ok(operator.json.evidence.sha256);
  });

  test("approval decision and audit export require operator", async () => {
    const decision = await call("/api/approvals/nonexistent/decision", {
      method: "POST",
      token: MEM_KEY,
      body: { decision: "approve" },
    });
    assert.equal(decision.status, 403);

    const exportAnon = await call("/api/audit/export?format=json");
    assert.equal(exportAnon.status, 401);

    const exportOp = await call("/api/audit/export?format=json", { token: OP_KEY });
    assert.equal(exportOp.status, 200);
    assert.ok(exportOp.json.count >= 1);
  });

  test("wrong token is rejected", async () => {
    const bad = await call("/api/evidence", { token: "not-a-real-key" });
    assert.equal(bad.status, 401);
  });
});