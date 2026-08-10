#!/usr/bin/env node
/**
 * UnityLink OS — health monitor.
 *
 * Polls the configured health endpoints and emits JSON status lines. Exits
 * non-zero when any endpoint is unhealthy so a supervisor (cron/launchd/
 * systemd/supervisor) can page or restart the deployment.
 *
 * Env:
 *   MONITOR_URLS   (required) comma-separated health URLs
 *   MONITOR_INTERVAL (optional, seconds, default 30)
 *   MONITOR_ONCE   (optional, "1") single check then exit
 *   LOG_LEVEL      (optional, default info)
 *
 * Run: node scripts/monitor.mjs
 */
import { log } from "../server/lib/log.mjs";

const URLS = (process.env.MONITOR_URLS || "").split(",").map((s) => s.trim()).filter(Boolean);
const INTERVAL = Number(process.env.MONITOR_INTERVAL || 30) * 1000;
const ONCE = process.env.MONITOR_ONCE === "1";

async function check(url) {
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const body = await res.text();
    let json = null;
    try { json = JSON.parse(body); } catch { /* not json */ }
    return {
      url,
      ok: res.ok && (json ? json.ok !== false : true),
      status: res.status,
      durationMs: Date.now() - started,
      detail: json?.upstreams ?? null,
    };
  } catch (err) {
    return { url, ok: false, status: 0, durationMs: Date.now() - started, error: err.message };
  }
}

async function tick() {
  const results = await Promise.all(URLS.map(check));
  const allOk = results.every((r) => r.ok);
  for (const r of results) {
    if (r.ok) log.info("monitor_ok", r);
    else log.error("monitor_fail", r);
  }
  log.info("monitor_tick", { checked: results.length, ok: allOk, at: new Date().toISOString() });
  return allOk;
}

if (URLS.length === 0) {
  log.error("monitor_no_urls", { detail: "Set MONITOR_URLS to comma-separated health endpoints." });
  process.exit(2);
}

if (ONCE) {
  const ok = await tick();
  process.exit(ok ? 0 : 1);
}

// Continuous loop.
let running = true;
const loop = async () => {
  if (!running) return;
  const ok = await tick();
  if (!ok) {
    log.error("monitor_unhealthy", { detail: "One or more endpoints unhealthy; supervisor should act." });
  }
  setTimeout(loop, INTERVAL);
};
loop();

process.on("SIGINT", () => { running = false; process.exit(0); });
process.on("SIGTERM", () => { running = false; process.exit(0); });