#!/usr/bin/env node
/**
 * UnityLink OS — backup and restore engine.
 *
 * Creates a timestamped, checksummed archive of the evidence vault (SQLite DB
 * + content-addressed vault files) and restores from it. Every backup carries
 * a MANIFEST with SHA-256 checksums so restoration is verified, not assumed.
 *
 * Zero npm dependencies: archives are produced with the system `tar` binary
 * (available on macOS and Linux/CI runners).
 *
 * Usage (library):
 *   import { createBackup, restoreBackup, listBackups } from "./lib/backup.mjs";
 *
 * CLI:
 *   node scripts/lib/backup.mjs backup  --db data/evidence.db --vault data/vault --out data/backups
 *   node scripts/lib/backup.mjs restore --backup data/backups/unitylink-backup-*.tar.gz --db data/evidence.db --vault data/vault
 *   node scripts/lib/backup.mjs list    --out data/backups
 */
import {
  createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync,
  readFileSync, rmSync, statSync, copyFileSync, renameSync, writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import path from "node:path";

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (c) => hash.update(c));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Create a backup archive.
 * @param {object} opts { db, vaultDir, outDir, label? }
 * @returns {Promise<{ archivePath, manifestPath, entries: string[], sha256: string }>}
 */
export async function createBackup({ db, vaultDir, outDir, label = "unitylink-backup" }) {
  if (!existsSync(db)) throw new Error(`Backup source DB not found: ${db}`);
  if (!existsSync(vaultDir)) throw new Error(`Backup source vault dir not found: ${vaultDir}`);
  mkdirSync(outDir, { recursive: true });

  const ts = stamp();
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, "-");
  const archivePath = path.join(outDir, `${safeLabel}-${ts}.tar.gz`);
  const manifestPath = path.join(outDir, `${safeLabel}-${ts}.manifest.json`);

  // Stage db + vault into a temp dir with a stable layout.
  const staging = `${archivePath}.stage-${process.pid}`;
  mkdirSync(path.join(staging, "vault"), { recursive: true });
  try {
    copyFileSync(db, path.join(staging, "evidence.db"));
    const walk = (dir, prefix) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        const rel = prefix ? `${prefix}/${name}` : name;
        if (statSync(full).isDirectory()) {
          mkdirSync(path.join(staging, "vault", rel), { recursive: true });
          walk(full, rel);
        } else {
          copyFileSync(full, path.join(staging, "vault", rel));
        }
      }
    };
    walk(vaultDir, "");

    // Build manifest with checksums over the staged layout.
    const manifest = {
      format: "unitylink-backup/v1",
      createdAt: new Date().toISOString(),
      label: safeLabel,
      db: "evidence.db",
      vaultDir: "vault",
      files: [],
    };
    const collect = async (dir, prefix) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        const rel = prefix ? `${prefix}/${name}` : name;
        if (statSync(full).isDirectory()) await collect(full, rel);
        else manifest.files.push({ path: rel, sha256: await sha256File(full), size: statSync(full).size });
      }
    };
    await collect(staging, "");
    writeFileSync(path.join(staging, "MANIFEST.json"), JSON.stringify(manifest, null, 2) + "\n");

    // Archive the staged layout with system tar.
    execFileSync("tar", ["-czf", archivePath, "-C", staging, "."], { stdio: "pipe" });

    const archiveSha = await sha256File(archivePath);
    manifest.archiveSha256 = archiveSha;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

    return { archivePath, manifestPath, entries: manifest.files.map((f) => f.path), sha256: archiveSha };
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

/**
 * Restore a backup archive into the target db + vault dir.
 * Verifies every file's SHA-256 against the manifest before writing.
 * @param {object} opts { archivePath, db, vaultDir }
 * @returns {Promise<{ restored: string[], verified: boolean, manifest: object }>}
 */
export async function restoreBackup({ archivePath, db, vaultDir }) {
  if (!existsSync(archivePath)) throw new Error(`Backup archive not found: ${archivePath}`);

  const staging = `${archivePath}.restore-${process.pid}`;
  mkdirSync(staging, { recursive: true });
  try {
    execFileSync("tar", ["-xzf", archivePath, "-C", staging], { stdio: "pipe" });

    const manifestPath = path.join(staging, "MANIFEST.json");
    if (!existsSync(manifestPath)) throw new Error("Backup archive has no MANIFEST.json — refusing to restore.");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (manifest.format !== "unitylink-backup/v1") throw new Error(`Unknown backup format: ${manifest.format}`);

    // Verify checksums before writing anything into place.
    const verified = [];
    for (const f of manifest.files) {
      const abs = path.join(staging, f.path);
      if (!existsSync(abs)) throw new Error(`Backup is missing file ${f.path}`);
      const actual = await sha256File(abs);
      if (actual !== f.sha256) throw new Error(`Checksum mismatch on ${f.path}: expected ${f.sha256}, got ${actual}`);
      verified.push(f.path);
    }

    // Write into place.
    mkdirSync(path.dirname(db), { recursive: true });
    mkdirSync(vaultDir, { recursive: true });
    for (const f of manifest.files) {
      const src = path.join(staging, f.path);
      if (f.path === manifest.db) {
        copyFileSync(src, db);
      } else if (f.path.startsWith("vault/")) {
        const rel = f.path.slice("vault/".length);
        const dest = path.join(vaultDir, rel);
        mkdirSync(path.dirname(dest), { recursive: true });
        copyFileSync(src, dest);
      }
    }

    return { restored: verified, verified: true, manifest };
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

/** List backups in a directory, newest first. */
export function listBackups(outDir) {
  if (!existsSync(outDir)) return [];
  return readdirSync(outDir)
    .filter((f) => f.endsWith(".tar.gz"))
    .map((f) => ({ name: f, path: path.join(outDir, f), size: statSync(path.join(outDir, f)).size }))
    .sort((a, b) => b.name.localeCompare(a.name));
}

// CLI
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      db: { type: "string" },
      vault: { type: "string" },
      out: { type: "string" },
      backup: { type: "string" },
      label: { type: "string" },
    },
  });
  const cmd = positionals[0];
  const db = values.db || "./data/evidence.db";
  const vaultDir = values.vault || "./data/vault";
  const outDir = values.out || "./data/backups";

  if (cmd === "backup") {
    const result = await createBackup({ db, vaultDir, outDir, label: values.label });
    console.log(JSON.stringify({ ok: true, archivePath: result.archivePath, sha256: result.sha256, files: result.entries.length }, null, 2));
  } else if (cmd === "restore") {
    if (!values.backup) throw new Error("restore requires --backup <archive>");
    const result = await restoreBackup({ archivePath: values.backup, db, vaultDir });
    console.log(JSON.stringify({ ok: true, verified: result.verified, restored: result.restored.length }, null, 2));
  } else if (cmd === "list") {
    console.log(JSON.stringify(listBackups(outDir), null, 2));
  } else {
    console.error("Usage: node scripts/lib/backup.mjs <backup|restore|list> [--db PATH] [--vault DIR] [--out DIR] [--backup ARCHIVE]");
    process.exit(1);
  }
}