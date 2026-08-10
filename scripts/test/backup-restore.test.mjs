/**
 * UnityLink OS — backup and restore end-to-end test.
 *
 * Proves the UNI-8 success condition: backups restore successfully in a test.
 * Creates a real evidence DB + vault content, backs it up, wipes the originals,
 * restores from the archive, and verifies checksums + row counts match.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { openDb } from "../../server/evidence-vault/db.mjs";
import { addEvidence, addSource, createPacket, listEvidence, listSources } from "../../server/evidence-vault/vault.mjs";
import { createBackup, restoreBackup, listBackups } from "../lib/backup.mjs";

test("backup then restore preserves the evidence vault exactly", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "uni-backup-"));
  const dbPath = path.join(dir, "evidence.db");
  const vaultDir = path.join(dir, "vault");
  const outDir = path.join(dir, "backups");
  mkdirSync(vaultDir, { recursive: true });

  try {
    // 1. Seed a real DB + vault files.
    const db = openDb(dbPath);
    const item = addEvidence(db, "operator", {
      title: "Backup Test Doc",
      kind: "document",
      content: Buffer.from("backup restore test content"),
      vaultDir,
      tags: ["backup", "test"],
    });
    const source = addSource(db, "operator", { title: "Test Source", kind: "correspondence" });
    const packet = createPacket(db, "operator", { title: "Packet", payload: { revenue: 42 } });
    const preCount = listEvidence(db).length;
    const preSourceCount = listSources(db).length;
    const preVaultFiles = readAllFiles(vaultDir).length;
    db.close();

    // 2. Backup.
    const backup = await createBackup({ db: dbPath, vaultDir, outDir, label: "uni-test" });
    assert.ok(existsSync(backup.archivePath));
    assert.ok(backup.sha256.length === 64);
    assert.ok(backup.entries.includes("evidence.db"));
    assert.ok(backup.entries.some((e) => e.startsWith("vault/") && e.includes(item.sha256)));
    assert.equal(listBackups(outDir).length, 1);

    // 3. Destroy the originals (simulated data loss).
    rmSync(dbPath, { force: true });
    rmSync(vaultDir, { recursive: true, force: true });
    assert.ok(!existsSync(dbPath));
    assert.ok(!existsSync(vaultDir));

    // 4. Restore.
    const restored = await restoreBackup({ archivePath: backup.archivePath, db: dbPath, vaultDir });
    assert.equal(restored.verified, true);
    assert.ok(restored.restored.includes("evidence.db"));
    assert.ok(restored.restored.some((e) => e.startsWith("vault/") && e.includes(item.sha256)));

    // 5. Verify data survived.
    const db2 = openDb(dbPath);
    const items = listEvidence(db2);
    assert.equal(items.length, preCount);
    assert.equal(items[0].title, "Backup Test Doc");
    assert.equal(items[0].sha256, item.sha256);
    assert.equal(listSources(db2).length, preSourceCount);
    const packetAfter = db2.prepare("SELECT * FROM packets WHERE id = ?").get(packet.packet.id);
    assert.equal(packetAfter.title, "Packet");
    db2.close();

    // Vault file content matches the original checksum.
    const restoredVaultFiles = readAllFiles(vaultDir);
    assert.equal(restoredVaultFiles.length, preVaultFiles);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("restore refuses an archive whose file fails checksum verification", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "uni-backup-tamper-"));
  const dbPath = path.join(dir, "evidence.db");
  const vaultDir = path.join(dir, "vault");
  const outDir = path.join(dir, "backups");
  mkdirSync(vaultDir, { recursive: true });

  try {
    const db = openDb(dbPath);
    addEvidence(db, "operator", { title: "Doc", kind: "document", content: Buffer.from("tamper me"), vaultDir });
    db.close();

    const backup = await createBackup({ db: dbPath, vaultDir, outDir, label: "uni-tamper" });

    // Extract, tamper with the DB inside the archive, re-archive.
    const tamperDir = path.join(dir, "tamper");
    mkdirSync(tamperDir, { recursive: true });
    execFileSync("tar", ["-xzf", backup.archivePath, "-C", tamperDir]);
    writeFileSync(path.join(tamperDir, "evidence.db"), "CORRUPTED");
    const tamperedArchive = path.join(dir, "tampered.tar.gz");
    execFileSync("tar", ["-czf", tamperedArchive, "-C", tamperDir, "."]);

    await assert.rejects(
      restoreBackup({ archivePath: tamperedArchive, db: dbPath, vaultDir }),
      /Checksum mismatch/,
    );
    // Originals must be untouched after a failed restore.
    assert.ok(existsSync(dbPath));
    const db2 = openDb(dbPath);
    assert.equal(listEvidence(db2).length, 1);
    db2.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function readAllFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const full = path.join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(full);
    }
  };
  walk(dir);
  return out;
}