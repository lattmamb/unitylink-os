#!/usr/bin/env node
/**
 * UnityLink OS — production-like server.
 *
 * Single entry point that serves the built frontend (dist/) and reverse-proxies
 * the API services (evidence vault, control-plane bridge, fleet) behind one
 * origin, with a public aggregate health endpoint and structured request
 * logging. This is the monitored deployment target for the pilot.
 *
 * Routing:
 *   /                     static SPA (dist/)
 *   /api/health           public aggregate health (checks all upstreams)
 *   /api/evidence/*       -> evidence vault   (http://127.0.0.1:8788/api/*)
 *   /api/control-plane/*  -> control-plane    (http://127.0.0.1:8787/api/control-plane/*)
 *   /api/fleet/*          -> fleet mobility   (http://127.0.0.1:8789/api/*)
 *
 * Env:
 *   PROD_PORT            (optional, default 8080)
 *   PROD_DIST            (optional, default ./dist)
 *   EVIDENCE_UPSTREAM    (optional, default http://127.0.0.1:8788)
 *   CONTROL_PLANE_UPSTREAM (optional, default http://127.0.0.1:8787)
 *   FLEET_UPSTREAM       (optional, default http://127.0.0.1:8789)
 *   LOG_LEVEL            (optional, default info)
 *
 * Run: node server/production.mjs
 */
import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { log, requestLogger } from "./lib/log.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const PORT = Number(process.env.PROD_PORT || 8080);
const DIST = path.resolve(process.env.PROD_DIST || path.join(ROOT, "dist"));
const UPSTREAMS = {
  evidence: (process.env.EVIDENCE_UPSTREAM || "http://127.0.0.1:8788").replace(/\/$/, ""),
  controlPlane: (process.env.CONTROL_PLANE_UPSTREAM || "http://127.0.0.1:8787").replace(/\/$/, ""),
  // Fleet is optional: enable by setting FLEET_UPSTREAM when the fleet
  // mobility service is deployed.
  fleet: (process.env.FLEET_UPSTREAM || "").replace(/\/$/, ""),
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
};

function serveStatic(res, filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) return false;
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
  });
  createReadStream(filePath).pipe(res);
  return true;
}

async function proxy(req, res, upstream, rewrite) {
  const url = new URL(req.url, "http://localhost");
  const targetPath = rewrite ? rewrite(url.pathname) : url.pathname;
  const target = `${upstream}${targetPath}${url.search}`;
  const headers = { ...req.headers, host: new URL(upstream).host };
  try {
    const upstreamRes = await fetch(target, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : req,
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });
    res.writeHead(upstreamRes.status, {
      "content-type": upstreamRes.headers.get("content-type") || "application/json",
      "cache-control": upstreamRes.headers.get("cache-control") || "no-store",
    });
    const buf = Buffer.from(await upstreamRes.arrayBuffer());
    res.end(buf);
    return upstreamRes.status;
  } catch (err) {
    log.error("proxy_upstream_error", { upstream, targetPath, error: err.message });
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "upstream_unavailable", detail: err.message }));
    return 502;
  }
}

async function checkHealth(upstream, pathname) {
  try {
    const res = await fetch(`${upstream}${pathname}`, { signal: AbortSignal.timeout(5000) });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  const reqLog = requestLogger(req, "production");
  const method = (req.method || "GET").toUpperCase();

  try {
    // Public aggregate health.
    if (method === "GET" && url.pathname === "/api/health") {
      const checks = {
        evidence: await checkHealth(UPSTREAMS.evidence, "/api/health"),
        controlPlane: await checkHealth(UPSTREAMS.controlPlane, "/api/control-plane/health"),
      };
      if (UPSTREAMS.fleet) checks.fleet = await checkHealth(UPSTREAMS.fleet, "/api/health");
      const ok = Object.values(checks).every((c) => c.ok);
      reqLog.done(ok ? 200 : 503, null);
      res.writeHead(ok ? 200 : 503, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify({
        ok,
        service: "unitylink-os/production",
        time: new Date().toISOString(),
        upstreams: checks,
      }));
      return;
    }

    // API proxies.
    if (url.pathname.startsWith("/api/evidence/") || url.pathname === "/api/evidence") {
      // Exact /api/evidence is forwarded unchanged (vault strips the /api
      // prefix); /api/evidence/* is rewritten to /api/*.
      const status = await proxy(req, res, UPSTREAMS.evidence, (p) =>
        p.startsWith("/api/evidence/") ? p.replace(/^\/api\/evidence/, "/api") : p);
      reqLog.done(status, null);
      return;
    }
    if (url.pathname.startsWith("/api/control-plane/")) {
      const status = await proxy(req, res, UPSTREAMS.controlPlane, (p) => p);
      reqLog.done(status, null);
      return;
    }
    if (url.pathname.startsWith("/api/fleet/") || url.pathname === "/api/fleet") {
      if (!UPSTREAMS.fleet) {
        reqLog.done(404, null);
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "fleet_not_deployed", detail: "FLEET_UPSTREAM is not configured." }));
        return;
      }
      const status = await proxy(req, res, UPSTREAMS.fleet, (p) =>
        p.startsWith("/api/fleet/") ? p.replace(/^\/api\/fleet/, "/api") : p);
      reqLog.done(status, null);
      return;
    }

    // Static SPA.
    if (method === "GET" || method === "HEAD") {
      let filePath = path.join(DIST, url.pathname === "/" ? "index.html" : url.pathname);
      if (!serveStatic(res, filePath)) {
        // SPA fallback.
        const index = path.join(DIST, "index.html");
        if (serveStatic(res, index)) {
          reqLog.done(200, null);
          return;
        }
        reqLog.done(404, null);
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("Not found");
        return;
      }
      reqLog.done(200, null);
      return;
    }

    reqLog.done(405, null);
    res.writeHead(405, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "method_not_allowed" }));
  } catch (err) {
    reqLog.done(500, null);
    log.error("production_server_error", { error: err.message });
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "internal_error" }));
  }
});

server.listen(PORT, () => {
  log.info("production_server_started", { port: PORT, dist: DIST, upstreams: UPSTREAMS });
  if (!existsSync(path.join(DIST, "index.html"))) {
    log.warn("production_dist_missing", { detail: `Run 'npm run build' first; ${DIST}/index.html not found.` });
  }
});