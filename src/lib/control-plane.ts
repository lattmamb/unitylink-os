/**
 * UnityLink OS — Paperclip control-plane client.
 *
 * Read-only client for the control-plane bridge (`server/control-plane.mjs`).
 * The bridge keeps the Paperclip token server-side; the browser only talks to
 * the bridge over the Vite dev proxy (`/api/control-plane/*`).
 */

import { authHeaders } from "./auth";

export interface CompanySummary {
  id: string;
  name: string | null;
  memberCount: number;
}

export interface IssueSummary {
  id: string;
  identifier: string;
  title: string;
  status: string;
  priority: string;
  project: string | null;
  projectId: string | null;
  goal: string | null;
  goalId: string | null;
  parent: string | null;
  assignee: string | null;
  blockedBy: Array<{ id: string; identifier: string; title: string; status: string; priority: string }>;
  blocks: Array<{ id: string; identifier: string; title: string; status: string }>;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  billingCode: string | null;
  labels: string[];
  monitorNextCheckAt: string | null;
  workMode: string | null;
}

export interface IssueDetail extends IssueSummary {
  description: string | null;
  ancestors: Array<{ id: string; identifier: string; title: string; status: string }>;
  comments: Array<{ id: string; authorAgentId: string | null; authorUserId: string | null; body: string; createdAt: string }>;
  documents: Array<{ key: string; title: string; format: string; updatedAt: string | null }>;
  workProducts: Array<{ id: string; kind: string; title: string; status: string; createdAt: string | null; url: string | null }>;
}

export interface Overview {
  company: CompanySummary;
  counts: {
    projects: number;
    issues: number;
    issuesByStatus: Record<string, number>;
    blockedIssues: number;
    blockers: number;
    approvals: number;
    pendingApprovals: number;
    agents: number;
    agentsRunning: number;
    goals: number;
  };
  recentIssues: IssueSummary[];
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  targetDate: string | null;
  createdAt: string | null;
  counts: { total: number; open: number; blocked: number; done: number };
}

export interface ApprovalSummary {
  id: string;
  type: string;
  title: string;
  summary: string | null;
  recommendedAction: string | null;
  status: string;
  requestedByAgentId: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AgentSummary {
  id: string;
  name: string;
  role: string;
  title: string | null;
  status: string;
  reportsTo: string | null;
  lastHeartbeatAt: string | null;
}

export interface GoalSummary {
  id: string;
  title: string;
  status: string;
  level: string | null;
  parentId: string | null;
  createdAt: string | null;
}

export interface ActivityEvent {
  id: string;
  actorType: string;
  actorId: string;
  agentId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  meta: Record<string, unknown> | null;
}

const BASE = "/api/control-plane";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json", ...authHeaders() },
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* keep status text */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const controlPlane = {
  health: () => get<{ ok: boolean; api: string; time: string }>("/health"),
  overview: () => get<Overview>("/overview"),
  projects: () => get<{ projects: ProjectSummary[] }>("/projects"),
  issues: (params?: { status?: string; projectId?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.projectId) q.set("projectId", params.projectId);
    const qs = q.toString();
    return get<{ issues: IssueSummary[] }>(`/issues${qs ? `?${qs}` : ""}`);
  },
  issue: (id: string) => get<IssueDetail>(`/issues/${encodeURIComponent(id)}`),
  approvals: (status?: string) =>
    get<{ approvals: ApprovalSummary[] }>(`/approvals${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  agents: () => get<{ agents: AgentSummary[] }>("/agents"),
  goals: () => get<{ goals: GoalSummary[] }>("/goals"),
  activity: (limit = 50) => get<{ events: ActivityEvent[] }>(`/activity?limit=${limit}`),
};

export const STATUS_META: Record<string, { label: string; className: string; dot: string }> = {
  todo: { label: "Todo", className: "border-white/10 bg-white/[0.06] text-white/70", dot: "bg-white/40" },
  backlog: { label: "Backlog", className: "border-white/10 bg-white/[0.04] text-white/50", dot: "bg-white/25" },
  in_progress: { label: "In progress", className: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200", dot: "bg-cyan-300" },
  in_review: { label: "In review", className: "border-amber-300/25 bg-amber-300/10 text-amber-200", dot: "bg-amber-300" },
  blocked: { label: "Blocked", className: "border-red-400/25 bg-red-400/10 text-red-300", dot: "bg-red-400" },
  done: { label: "Done", className: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200", dot: "bg-emerald-300" },
  cancelled: { label: "Cancelled", className: "border-white/10 bg-white/[0.04] text-white/45", dot: "bg-white/25" },
};

export function statusMeta(status: string) {
  return STATUS_META[status] || { label: status, className: "border-white/10 bg-white/[0.06] text-white/70", dot: "bg-white/40" };
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}