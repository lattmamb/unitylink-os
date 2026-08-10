#!/usr/bin/env node
/**
 * UnityLink OS — structured JSON logging.
 *
 * Emits one JSON object per line to stdout (captured by the process manager /
 * monitoring stack). Level filtering via LOG_LEVEL (debug|info|warn|error,
 * default info). Never logs secrets: request logging records method, path,
 * status, duration, and actor role — never headers or bodies.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const configured = (process.env.LOG_LEVEL || "info").toLowerCase();
const threshold = LEVELS[configured] ?? LEVELS.info;

function emit(level, msg, fields = {}) {
  if ((LEVELS[level] ?? LEVELS.info) < threshold) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...fields,
  });
  // eslint-disable-next-line no-console
  console.log(line);
}

export const log = {
  debug: (msg, fields) => emit("debug", msg, fields),
  info: (msg, fields) => emit("info", msg, fields),
  warn: (msg, fields) => emit("warn", msg, fields),
  error: (msg, fields) => emit("error", msg, fields),
};

/**
 * Request logging middleware for http.createServer handlers.
 * Call at the top of the handler; call `done(status, actor)` when the
 * response is about to be written (or in a finally block).
 */
export function requestLogger(req, service) {
  const start = process.hrtime.bigint();
  const url = new URL(req.url || "/", "http://localhost");
  return {
    done(status = 500, actor = null) {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      log.info("request", {
        service,
        method: (req.method || "GET").toUpperCase(),
        path: url.pathname,
        status,
        durationMs: Math.round(ms * 10) / 10,
        actor: actor || null,
      });
    },
  };
}