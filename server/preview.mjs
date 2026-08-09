#!/usr/bin/env node
/**
 * UnityLink OS — preview static server.
 *
 * Serves the production build (dist/) and proxies /api/control-plane/* to the
 * control-plane bridge so the preview shows live Paperclip data.
 *
 * Env:
 *   PREVIEW_PORT      (optional, default 4173)
 *   CONTROL_PLANE_URL (optional, default http://127.0.0.1:8787)
 *
 * Run: node server/preview.mjs
 */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../dist", import.meta.url));
const PORT = Number(process.env.CONTROL_PLANE_PORT || 4173);
const BRIDGE = (process.env.CONTROL_PLANE_URL || "http://127.0.0.1:8787").replace(/\/$/, "");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webp": "image/webp",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  // Proxy control-plane API calls to the bridge.
  if (url.pathname.startsWith("/api/control-plane/")) {
    const target = new URL(url.pathname + url.search, BRIDGE);
    const upstream = http.request(
      target,
      { method: req.method, headers: { ...req.headers, host: target.host } },
      (up) => {
        res.writeHead(up.statusCode || 502, up.headers);
        up.pipe(res);
      }
    );
    upstream.on("error", () => {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "bridge unreachable" }));
    });
    req.pipe(upstream);
    return;
  }

  // Static files from dist/ with SPA fallback to index.html.
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const filePath = normalize(join(ROOT, pathname));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { "content-type": MIME[extname(filePath)] || "application/octet-stream" });
    res.end(body);
  } catch {
    try {
      const body = await readFile(join(ROOT, "index.html"));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`UnityLink OS preview → http://localhost:${PORT} (bridge: ${BRIDGE})`);
});