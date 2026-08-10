#!/usr/bin/env node
/**
 * UnityLink OS — Paperclip control-plane bridge.
 *
 * Read-only proxy between the UnityLink OS frontend and the Paperclip company
 * control plane API. The operator token (PAPERCLIP_API_KEY) stays server-side;
 * it is never shipped to the browser.
 *
 * Endpoints (all GET, JSON):
 *   /api/control-plane/health
 *   /api/control-plane/overview          — company summary: counts, budgets, approvals
 *   /api/control-plane/projects          — projects with issue counts
 *   /api/control-plane/issues            — issues (optional ?status= & ?projectId=)
 *   /api/control-plane/issues/:id        — full issue record + comments + blockers
 *   /api/control-plane/approvals         — approvals (optional ?status=)
 *   /api/control-plane/agents            — company agents
 *   /api/control-plane/goals             — company goals
 *   /api/control-plane/activity          — recent audit history (optional ?limit=)
 *
 * Env:
 *   PAPERCLIP_API_URL   (required) e.g. http://127.0.0.1:3100
 *   PAPERCLIP_API_KEY   (required) operator/agent bearer token
 *   CONTROL_PLANE_PORT  (optional, default 8787)
 *   CONTROL_PLANE_CORS  (optional origin allowlist, comma separated; default *)
 *   UNITYLINK_OPERATOR_KEY (required) operator bearer token for this bridge;
 *                          all data routes are operator-only. /health is public.
 *   LOG_LEVEL           (optional, default info)
 *
 * Run: node server/control-plane.mjs
 */

import http from "node:http";
import { URL } from "node:url";
import { createAuth, authenticate, requireOperatorWith } from "./lib/auth.mjs";
import { log, requestLogger } from "./lib/log.mjs";

const API = (process.env.PAPERCLIP_API_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
const TOKEN = process.env.PAPERCLIP_API_KEY || "";
const PORT = Number(process.env.CONTROL_PLANE_PORT || 8787);
const CORS_ALLOW = (process.env.CONTROL_PLANE_CORS || "*").split(",").map((s) => s.trim());

const COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID || "";
const AUTH = createAuth();

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": CORS_ALLOW.includes("*") ? "*" : CORS_ALLOW[0],
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(payload);
}

async function fetchJson(path, { signal } = {}) {
  const url = `${API}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/json",
    },
    signal: signal || AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw Object.assign(new Error(`Paperclip API ${res.status} on ${path}`), { status: res.status });
  }
  return res.json();
}

function summarizeIssue(issue) {
  return {
    id: issue.id,
    identifier: issue.identifier || issue.issueNumber,
    title: issue.title,
    status: issue.status,
    priority: issue.priority,
    project: issue.project?.name || null,
    projectId: issue.projectId || null,
    goal: issue.goal?.title || null,
    goalId: issue.goalId || null,
    parent: issue.parentId || null,
    assignee: issue.assigneeAgentId || null,
    blockedBy: (issue.blockedBy || []).map((b) => ({
      id: b.id,
      identifier: b.identifier,
      title: b.title,
      status: b.status,
      priority: b.priority,
    })),
    blocks: (issue.blocks || []).map((b) => ({ id: b.id, identifier: b.identifier, title: b.title, status: b.status })),
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    completedAt: issue.completedAt || null,
    billingCode: issue.billingCode || null,
    labels: (issue.labels || []).map((l) => (typeof l === "string" ? l : l.name)),
    monitorNextCheckAt: issue.monitorNextCheckAt || null,
    workMode: issue.workMode || null,
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method || "GET";
  const reqLog = requestLogger(req, "control-plane");
  const actor = authenticate(req, AUTH.store)?.id ?? null;

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end();
    reqLog.done(204, actor);
    return;
  }

  if (method !== "GET") {
    reqLog.done(405, actor);
    json(res, 405, { error: "method_not_allowed", detail: "Control-plane bridge is read-only (GET only)." });
    return;
  }

  if (!TOKEN) {
    reqLog.done(503, actor);
    json(res, 503, { error: "missing_token", detail: "PAPERCLIP_API_KEY is not configured on the bridge." });
    return;
  }

  try {
    // Health (public, for monitoring)
    if (path === "/api/control-plane/health") {
      reqLog.done(200, actor);
      json(res, 200, { ok: true, api: API, time: new Date().toISOString() });
      return;
    }

    // Everything else requires the operator role
    const denied = requireOperatorWith(AUTH, req);
    if (denied) {
      reqLog.done(denied.status, actor);
      json(res, denied.status, denied);
      return;
    }

    // Overview: counts across the company
    if (path === "/api/control-plane/overview") {
      const [company, projects, issues, approvals, agents, goals] = await Promise.all([
        fetchJson(`/api/companies/${COMPANY_ID}`),
        fetchJson(`/api/companies/${COMPANY_ID}/projects`),
        fetchJson(`/api/companies/${COMPANY_ID}/issues`),
        fetchJson(`/api/companies/${COMPANY_ID}/approvals`),
        fetchJson(`/api/companies/${COMPANY_ID}/agents`),
        fetchJson(`/api/companies/${COMPANY_ID}/goals`),
      ]);
      const issueList = Array.isArray(issues) ? issues : issues.issues || [];
      const projectList = Array.isArray(projects) ? projects : projects.projects || [];
      const approvalList = Array.isArray(approvals) ? approvals : approvals.approvals || [];
      const agentList = Array.isArray(agents) ? agents : agents.agents || [];
      const goalList = Array.isArray(goals) ? goals : goals.goals || [];

      const byStatus = {};
      let blockers = 0;
      let blockedCount = 0;
      for (const i of issueList) {
        byStatus[i.status] = (byStatus[i.status] || 0) + 1;
        if (i.blockedBy?.length) blockedCount++;
        if (i.status === "blocked") blockers++;
      }

      reqLog.done(200, actor);
      json(res, 200, {
        company: { id: company.id, name: company.name || null, memberCount: agentList.length },
        counts: {
          projects: projectList.length,
          issues: issueList.length,
          issuesByStatus: byStatus,
          blockedIssues: blockedCount,
          blockers: blockers,
          approvals: approvalList.length,
          pendingApprovals: approvalList.filter((a) => (a.status || "pending") === "pending").length,
          agents: agentList.length,
          agentsRunning: agentList.filter((a) => a.status === "running").length,
          goals: goalList.length,
        },
        recentIssues: issueList
          .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
          .slice(0, 8)
          .map(summarizeIssue),
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    // Projects
    if (path === "/api/control-plane/projects") {
      const [projects, issues] = await Promise.all([
        fetchJson(`/api/companies/${COMPANY_ID}/projects`),
        fetchJson(`/api/companies/${COMPANY_ID}/issues`),
      ]);
      const projectList = Array.isArray(projects) ? projects : projects.projects || [];
      const issueList = Array.isArray(issues) ? issues : issues.issues || [];
      const byProject = {};
      for (const i of issueList) {
        const key = i.projectId || "none";
        byProject[key] = byProject[key] || { total: 0, open: 0, blocked: 0, done: 0 };
        byProject[key].total++;
        if (i.status === "blocked") byProject[key].blocked++;
        else if (i.status === "done" || i.status === "cancelled") byProject[key].done++;
        else byProject[key].open++;
      }
      reqLog.done(200, actor);
      json(res, 200, {
        projects: projectList.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          targetDate: p.targetDate || null,
          createdAt: p.createdAt || null,
          counts: byProject[p.id] || { total: 0, open: 0, blocked: 0, done: 0 },
        })),
      });
      return;
    }

    // Issues list
    if (path === "/api/control-plane/issues") {
      const status = url.searchParams.get("status") || "";
      const projectId = url.searchParams.get("projectId") || "";
      const data = await fetchJson(`/api/companies/${COMPANY_ID}/issues`);
      const issueList = Array.isArray(data) ? data : data.issues || [];
      const filtered = issueList.filter(
        (i) =>
          (!status || i.status === status) &&
          (!projectId || i.projectId === projectId)
      );
      reqLog.done(200, actor);
      json(res, 200, { issues: filtered.map(summarizeIssue) });
      return;
    }

    // Issue detail: match /api/control-plane/issues/:id
    const issueMatch = path.match(/^\/api\/control-plane\/issues\/([^/]+)$/);
    if (issueMatch) {
      const issueId = issueMatch[1];
      const issue = await fetchJson(`/api/issues/${issueId}`);
      let comments = [];
      let documents = [];
      let workProducts = [];
      try {
        const c = await fetchJson(`/api/issues/${issueId}/comments`);
        comments = Array.isArray(c) ? c : c.comments || [];
      } catch { /* optional */ }
      try {
        const d = await fetchJson(`/api/issues/${issueId}/documents`);
        documents = Array.isArray(d) ? d : d.documents || [];
      } catch { /* optional */ }
      workProducts = issue.workProducts || [];
      reqLog.done(200, actor);
      json(res, 200, {
        ...summarizeIssue(issue),
        description: issue.description || null,
        ancestors: (issue.ancestors || []).map((a) => ({ id: a.id, identifier: a.identifier, title: a.title, status: a.status })),
        comments: comments.map((cm) => ({
          id: cm.id,
          authorAgentId: cm.authorAgentId || null,
          authorUserId: cm.authorUserId || null,
          body: cm.body || cm.content || "",
          createdAt: cm.createdAt,
        })),
        documents: documents.map((d) => ({ key: d.key, title: d.title, format: d.format, updatedAt: d.updatedAt || null })),
        workProducts: (workProducts || []).map((w) => ({
          id: w.id,
          kind: w.kind,
          title: w.title || w.kind,
          status: w.status,
          createdAt: w.createdAt || null,
          url: w.url || null,
        })),
        labels: (issue.labels || []).map((l) => (typeof l === "string" ? l : l.name)),
      });
      return;
    }

    // Approvals
    if (path === "/api/control-plane/approvals") {
      const status = url.searchParams.get("status") || "";
      const data = await fetchJson(`/api/companies/${COMPANY_ID}/approvals`);
      const list = Array.isArray(data) ? data : data.approvals || [];
      const filtered = status ? list.filter((a) => (a.status || "pending") === status) : list;
      reqLog.done(200, actor);
      json(res, 200, {
        approvals: filtered.map((a) => ({
          id: a.id,
          type: a.type,
          title: a.payload?.title || a.title || a.type,
          summary: a.payload?.summary || null,
          recommendedAction: a.payload?.recommendedAction || null,
          status: a.status || "pending",
          requestedByAgentId: a.requestedByAgentId || null,
          createdAt: a.createdAt,
          resolvedAt: a.resolvedAt || null,
        })),
      });
      return;
    }

    // Agents
    if (path === "/api/control-plane/agents") {
      const data = await fetchJson(`/api/companies/${COMPANY_ID}/agents`);
      const list = Array.isArray(data) ? data : data.agents || [];
      reqLog.done(200, actor);
      json(res, 200, {
        agents: list.map((a) => ({
          id: a.id,
          name: a.name,
          role: a.role,
          title: a.title || null,
          status: a.status,
          reportsTo: a.reportsTo || null,
          lastHeartbeatAt: a.lastHeartbeatAt || null,
        })),
      });
      return;
    }

    // Goals
    if (path === "/api/control-plane/goals") {
      const data = await fetchJson(`/api/companies/${COMPANY_ID}/goals`);
      const list = Array.isArray(data) ? data : data.goals || [];
      reqLog.done(200, actor);
      json(res, 200, {
        goals: list.map((g) => ({
          id: g.id,
          title: g.title,
          status: g.status,
          level: g.level || null,
          parentId: g.parentId || null,
          createdAt: g.createdAt || null,
        })),
      });
      return;
    }

    // Activity / audit history
    if (path === "/api/control-plane/activity") {
      const limit = Number(url.searchParams.get("limit") || 50);
      const data = await fetchJson(`/api/companies/${COMPANY_ID}/activity?limit=${limit}`);
      const list = Array.isArray(data) ? data : data.activity || data.events || [];
      reqLog.done(200, actor);
      json(res, 200, {
        events: list.map((e) => ({
          id: e.id,
          actorType: e.actorType,
          actorId: e.actorId,
          agentId: e.agentId || null,
          action: e.action,
          entityType: e.entityType,
          entityId: e.entityId,
          createdAt: e.createdAt,
          meta: e.meta || null,
        })),
      });
      return;
    }

    reqLog.done(404, actor);
    json(res, 404, { error: "not_found", detail: `Unknown path ${path}` });
  } catch (err) {
    const status = err.status && err.status < 500 ? err.status : 502;
    reqLog.done(status, actor);
    log.error("control_plane_upstream_error", { error: err.message, path });
    json(res, status, { error: "upstream_error", detail: err.message, upstream: API });
  }
});

server.listen(PORT, () => {
  log.info("control_plane_started", { port: PORT, api: API, authConfigured: !AUTH.disabled });
  if (AUTH.disabled) {
    log.warn("control_plane_auth_disabled", { detail: "Set UNITYLINK_OPERATOR_KEY to protect data routes." });
  }
});
