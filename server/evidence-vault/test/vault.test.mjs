/**
 * UnityLink OS — evidence vault test suite.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../db.mjs";
import {
  addEvidence, listEvidence, getEvidence,
  addSource, listSources,
  addCitation, listCitations,
  requestApproval, decideApproval, executeGatedAction, listApprovals,
  createPacket, addPacketVersion, getPacket, getPacketVersion,
  exportAuditJSON, exportAuditCSV, exportAuditMarkdown,
  VaultError, ApprovalError,
} from "../vault.mjs";

describe("evidence vault", () => {
  test("adds and lists evidence items with SHA-256 content addressing", () => {
    const db = openDb();
    const item = addEvidence(db, "operator", {
      title: "Test Document",
      kind: "document",
      description: "A test document",
      fileName: "test.pdf",
      content: Buffer.from("test content"),
      vaultDir: "/tmp/vault-test",
      tags: ["test", "document"],
    });
    assert.equal(item.title, "Test Document");
    assert.equal(item.kind, "document");
    assert.equal(item.fileName, "test.pdf");
    assert.ok(item.sha256 && item.sha256.length === 64);
    assert.ok(item.vaultPath.includes(item.sha256));

    const all = listEvidence(db);
    assert.equal(all.length, 1);
    assert.equal(all[0].id, item.id);
  });

  test("same content produces same SHA-256 (content-addressed dedup)", () => {
    const db = openDb();
    const content = Buffer.from("dedup test content");
    const item1 = addEvidence(db, "operator", {
      title: "Doc 1", kind: "document", content, vaultDir: "/tmp/vault-test",
    });
    const item2 = addEvidence(db, "operator", {
      title: "Doc 2", kind: "document", content, vaultDir: "/tmp/vault-test",
    });
    assert.equal(item1.sha256, item2.sha256);
  });

  test("adds and lists sources", () => {
    const db = openDb();
    const source = addSource(db, "operator", {
      title: "30 ILCS 105/5.878",
      kind: "statute",
      url: "https://ilga.gov",
      citation: "30 ILCS 105/5.878",
      authority: "Illinois General Assembly",
    });
    assert.equal(source.kind, "statute");
    const all = listSources(db);
    assert.equal(all.length, 1);
  });

  test("adds citations linking evidence to sources", () => {
    const db = openDb();
    const item = addEvidence(db, "operator", {
      title: "Receipt", kind: "receipt", content: Buffer.from("receipt data"), vaultDir: "/tmp/vault-test",
    });
    const source = addSource(db, "operator", {
      title: "Invoice", kind: "correspondence",
    });
    const citation = addCitation(db, "operator", item.id, source.id, "Supports the revenue line");
    assert.ok(citation.id);

    const all = listCitations(db, item.id);
    assert.equal(all.length, 1);
  });

  test("approval gate: request -> approve -> execute", () => {
    const db = openDb();
    const approval = requestApproval(db, "operator", {
      actionType: "payment",
      title: "Release disbursement",
      description: "Release $1,000 for site control",
    });
    assert.equal(approval.status, "pending");

    const decided = decideApproval(db, "operator", approval.id, "approve", "Review complete");
    assert.equal(decided.status, "approved");

    const result = executeGatedAction(db, "operator", approval.id, { description: "Disburse $1,000" });
    assert.equal(result.executed, true);
  });

  test("approval gate: blocked action refuses execution", () => {
    const db = openDb();
    const approval = requestApproval(db, "operator", {
      actionType: "contract",
      title: "Sign contract",
    });
    decideApproval(db, "operator", approval.id, "block", "Missing sign-off");

    assert.throws(
      () => executeGatedAction(db, "operator", approval.id),
      ApprovalError,
    );
  });

  test("approval gate: non-gated action type is rejected", () => {
    const db = openDb();
    assert.throws(
      () => requestApproval(db, "operator", { actionType: "not_gated", title: "x" }),
      VaultError,
    );
  });

  test("finance packet versioning: create, add version, retrieve history", () => {
    const db = openDb();
    const created = createPacket(db, "operator", {
      title: "Packet v1",
      payload: { revenue: 1000 },
      changeSummary: "Initial version",
    });
    assert.equal(created.version, 1);
    assert.ok(created.sha256);

    const v2 = addPacketVersion(db, "operator", created.packet.id, {
      payload: { revenue: 1200 },
      changeSummary: "Updated revenue",
    });
    assert.equal(v2.version, 2);
    assert.equal(v2.parentSha256, created.sha256);

    const packet = getPacket(db, created.packet.id);
    assert.equal(packet.versions.length, 2);
    assert.equal(packet.versions[0].version, 1);
    assert.equal(packet.versions[1].version, 2);

    const v1 = getPacketVersion(db, created.packet.id, 1);
    assert.equal(v1.body.revenue, 1000);
  });

  test("export audit JSON, CSV, and Markdown", () => {
    const db = openDb();
    addEvidence(db, "operator", {
      title: "Audit Test", kind: "document", content: Buffer.from("test"), vaultDir: "/tmp/vault-test",
    });
    const json = exportAuditJSON(db);
    assert.ok(json.count >= 1);
    assert.equal(json.source, "unitylink-os/evidence-vault");

    const csv = exportAuditCSV(db);
    assert.ok(csv.includes("evidence.add"));

    const md = exportAuditMarkdown(db);
    assert.ok(md.includes("Audit Report"));
    assert.ok(md.includes("evidence.add"));
  });
});