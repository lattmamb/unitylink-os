#!/usr/bin/env node
/**
 * UnityLink OS — authentication and role-based access control (RBAC).
 *
 * Zero-dependency bearer-token auth. Tokens are static API keys supplied via
 * environment variables; each key maps to a role. The server never ships keys
 * to the browser — the operator/member enters their key in the app and it is
 * sent as `Authorization: Bearer <key>` on every API call.
 *
 * Roles:
 *   operator  — full access: evidence, approvals, packets, audit export,
 *               control-plane dashboards, production API.
 *   member    — limited access: participant-facing endpoints only (e.g. the
 *               future intake/self-service surface). Members are denied all
 *               operator-only routes with 403.
 *
 * Env:
 *   UNITYLINK_OPERATOR_KEY   (required in production) operator bearer token
 *   UNITYLINK_MEMBER_KEY     (optional) member bearer token
 *
 * If no keys are configured the module reports `authDisabled: true` and every
 * protected route is denied with 503 so a misconfigured deployment fails
 * closed rather than open.
 */

export const ROLES = Object.freeze({
  OPERATOR: "operator",
  MEMBER: "member",
});

/**
 * Build an auth context from explicit keys (tests, embedded servers) or from
 * the environment. Returns `{ store, disabled }`.
 */
export function createAuth({ operatorKey, memberKey } = {}) {
  const op = operatorKey ?? process.env.UNITYLINK_OPERATOR_KEY ?? "";
  const mem = memberKey ?? process.env.UNITYLINK_MEMBER_KEY ?? "";
  const store = new Map();
  if (op) store.set(op, ROLES.OPERATOR);
  if (mem) store.set(mem, ROLES.MEMBER);
  return { store, disabled: !op && !mem };
}

/** Map of token -> role. Empty when auth is not configured. */
export function tokenStore() {
  return createAuth().store;
}

export function authDisabled() {
  return createAuth().disabled;
}

/**
 * Extract the bearer token from a request.
 * Accepts `Authorization: Bearer <token>` (preferred) and, for legacy
 * compatibility, the `X-Operator` header used by earlier builds.
 */
export function extractToken(req) {
  const auth = req.headers?.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  if (match) return match[1].trim();
  const legacy = req.headers?.["x-operator"];
  if (legacy && legacy !== "operator") return String(legacy).trim();
  return null;
}

/**
 * Authenticate a request. Returns `{ role, id }` or `null`.
 * `id` is a stable actor id derived from the role (operator/member) so audit
 * events attribute actions to a role-scoped actor.
 */
export function authenticate(req, store = tokenStore()) {
  if (!store || store.size === 0) return null;
  const token = extractToken(req);
  if (!token) return null;
  const role = store.get(token);
  if (!role) return null;
  return { role, id: role === ROLES.OPERATOR ? "operator" : "member" };
}

/**
 * Route guard. Returns an error object when the request is not authorized:
 *   { status: 401, error: "unauthorized" }   — no/invalid token
 *   { status: 403, error: "forbidden" }      — valid token, wrong role
 *   { status: 503, error: "auth_not_configured" } — server has no keys
 * Returns null when the request is allowed.
 */
export function requireRole(req, ...roles) {
  if (authDisabled()) {
    return { status: 503, error: "auth_not_configured", detail: "UNITYLINK_OPERATOR_KEY is not configured on this server." };
  }
  const actor = authenticate(req);
  if (!actor) {
    return { status: 401, error: "unauthorized", detail: "Missing or invalid bearer token." };
  }
  if (!roles.includes(actor.role)) {
    return { status: 403, error: "forbidden", detail: `Role '${actor.role}' is not allowed on this endpoint.` };
  }
  return null;
}

/** Convenience: operator-only guard. */
export function requireOperator(req) {
  return requireRole(req, ROLES.OPERATOR);
}

/** Convenience: any authenticated role. */
export function requireAnyRole(req) {
  return requireRole(req, ROLES.OPERATOR, ROLES.MEMBER);
}

/** Convenience: operator-only guard against an injected auth context. */
export function requireOperatorWith(auth, req) {
  if (auth.disabled) {
    return { status: 503, error: "auth_not_configured", detail: "UNITYLINK_OPERATOR_KEY is not configured on this server." };
  }
  const actor = authenticate(req, auth.store);
  if (!actor) {
    return { status: 401, error: "unauthorized", detail: "Missing or invalid bearer token." };
  }
  if (actor.role !== ROLES.OPERATOR) {
    return { status: 403, error: "forbidden", detail: `Role '${actor.role}' is not allowed on this endpoint.` };
  }
  return null;
}