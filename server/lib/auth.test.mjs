/**
 * UnityLink OS — auth + RBAC unit tests.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  createAuth, authenticate, requireRole, requireOperator, requireAnyRole,
  requireOperatorWith, extractToken, ROLES,
} from "./auth.mjs";

function reqWith(token) {
  return { headers: token ? { authorization: `Bearer ${token}` } : {} };
}

describe("auth module", () => {
  test("createAuth maps keys to roles and reports disabled when empty", () => {
    const auth = createAuth({ operatorKey: "op-secret", memberKey: "mem-secret" });
    assert.equal(auth.disabled, false);
    assert.equal(auth.store.get("op-secret"), ROLES.OPERATOR);
    assert.equal(auth.store.get("mem-secret"), ROLES.MEMBER);

    const empty = createAuth({});
    assert.equal(empty.disabled, true);
  });

  test("extractToken accepts Bearer and legacy X-Operator headers", () => {
    assert.equal(extractToken({ headers: { authorization: "Bearer abc123" } }), "abc123");
    assert.equal(extractToken({ headers: { authorization: "bearer abc123" } }), "abc123");
    assert.equal(extractToken({ headers: { "x-operator": "op-secret" } }), "op-secret");
    // legacy default "operator" is not treated as a token
    assert.equal(extractToken({ headers: { "x-operator": "operator" } }), null);
    assert.equal(extractToken({ headers: {} }), null);
  });

  test("authenticate returns role-scoped actor for valid tokens", () => {
    const auth = createAuth({ operatorKey: "op-secret", memberKey: "mem-secret" });
    assert.deepEqual(authenticate(reqWith("op-secret"), auth.store), { role: "operator", id: "operator" });
    assert.deepEqual(authenticate(reqWith("mem-secret"), auth.store), { role: "member", id: "member" });
    assert.equal(authenticate(reqWith("wrong"), auth.store), null);
    assert.equal(authenticate(reqWith(null), auth.store), null);
  });

  test("requireRole enforces operator-only routes", () => {
    const auth = createAuth({ operatorKey: "op-secret", memberKey: "mem-secret" });
    assert.equal(requireOperatorWith(auth, reqWith("op-secret")), null);
    const memberDenied = requireOperatorWith(auth, reqWith("mem-secret"));
    assert.equal(memberDenied.status, 403);
    assert.equal(memberDenied.error, "forbidden");
    const noToken = requireOperatorWith(auth, reqWith(null));
    assert.equal(noToken.status, 401);
    assert.equal(noToken.error, "unauthorized");
  });

  test("requireRole fails closed when auth is not configured", () => {
    const empty = createAuth({});
    const denied = requireOperatorWith(empty, reqWith("anything"));
    assert.equal(denied.status, 503);
    assert.equal(denied.error, "auth_not_configured");
  });

  test("requireAnyRole allows operator and member, denies anonymous", () => {
    const prevOp = process.env.UNITYLINK_OPERATOR_KEY;
    const prevMem = process.env.UNITYLINK_MEMBER_KEY;
    process.env.UNITYLINK_OPERATOR_KEY = "op-secret";
    process.env.UNITYLINK_MEMBER_KEY = "mem-secret";
    try {
      assert.equal(requireAnyRole(reqWith("op-secret")), null);
      assert.equal(requireAnyRole(reqWith("mem-secret")), null);
      assert.equal(requireAnyRole(reqWith(null)).status, 401);
    } finally {
      if (prevOp === undefined) delete process.env.UNITYLINK_OPERATOR_KEY;
      else process.env.UNITYLINK_OPERATOR_KEY = prevOp;
      if (prevMem === undefined) delete process.env.UNITYLINK_MEMBER_KEY;
      else process.env.UNITYLINK_MEMBER_KEY = prevMem;
    }
  });

  test("env-based auth reads UNITYLINK_OPERATOR_KEY", () => {
    const prev = process.env.UNITYLINK_OPERATOR_KEY;
    process.env.UNITYLINK_OPERATOR_KEY = "env-op-key";
    try {
      const auth = createAuth();
      assert.equal(auth.disabled, false);
      assert.equal(auth.store.get("env-op-key"), ROLES.OPERATOR);
    } finally {
      if (prev === undefined) delete process.env.UNITYLINK_OPERATOR_KEY;
      else process.env.UNITYLINK_OPERATOR_KEY = prev;
    }
  });
});