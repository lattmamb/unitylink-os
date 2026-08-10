/**
 * UnityLink OS — evidence vault client.
 *
 * Typed client for the evidence vault API (`server/evidence-vault/api.mjs`).
 * The browser talks to the vault over the Vite dev proxy (`/api/evidence/*`).
 */

export interface EvidenceItem {
  id: string;
  title: string;
  kind: string;
  description: string | null;
  fileName: string | null;
  sha256: string;
  vaultPath: string;
  tags: string[];
  status: string;
  source: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Source {
  id: string;
  title: string;
  kind: string;
  url: string | null;
  citation: string | null;
  authority: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Citation {
  id: string;
  evidence_id: string;
  source_id: string;
  note: string | null;
  created_at: string;
}

export interface ApprovalRequest {
  id: string;
  actionType: string;
  title: string;
  description: string | null;
  status: string;
  requestedBy: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: string;
  role: string;
  reason: string | null;
  detail: string | null;
  created_at: string;
}

export interface Packet {
  id: string;
  title: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  versions: Array<{
    id: string;
    packetId: string;
    version: number;
    sha256: string;
    parentSha256: string | null;
    body: unknown;
    changeSummary: string | null;
    createdBy: string;
    createdAt: string;
  }>;
}

const BASE = "/api/evidence";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", "X-Operator": "operator" },
    ...init,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* keep default message */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const evidenceVault = {
  health: () => request<{ ok: boolean; service: string }>("/health"),

  listEvidence: (opts: { kind?: string; status?: string } = {}) => {
    const q = new URLSearchParams();
    if (opts.kind) q.set("kind", opts.kind);
    if (opts.status) q.set("status", opts.status);
    const qs = q.toString();
    return request<{ evidence: EvidenceItem[] }>(`/evidence${qs ? `?${qs}` : ""}`);
  },

  getEvidence: (id: string) => request<{ evidence: EvidenceItem }>(`/evidence/${id}`),

  provenance: (id: string) =>
    request<{ evidence: EvidenceItem; provenance: AuditEvent[] }>(`/evidence/${id}/provenance`),

  uploadEvidence: (input: {
    title: string;
    kind: string;
    description?: string;
    fileName?: string;
    contentBase64: string;
    tags?: string[];
  }) =>
    request<{ evidence: EvidenceItem }>("/evidence", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  listSources: () => request<{ sources: Source[] }>("/sources"),

  addSource: (input: {
    title: string;
    kind: string;
    url?: string;
    citation?: string;
    authority?: string;
    notes?: string;
  }) =>
    request<{ source: Source }>("/sources", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  addCitation: (evidenceId: string, sourceId: string, note?: string) =>
    request<{ citation: Citation }>(`/evidence/${evidenceId}/citations`, {
      method: "POST",
      body: JSON.stringify({ sourceId, note }),
    }),

  listCitations: (evidenceId: string) =>
    request<{ citations: Citation[] }>(`/evidence/${evidenceId}/citations`),

  listApprovals: (status?: string) => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return request<{ approvals: ApprovalRequest[] }>(`/approvals${qs}`);
  },

  requestApproval: (input: { actionType: string; title: string; description?: string }) =>
    request<{ approval: ApprovalRequest }>("/approvals", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  decideApproval: (id: string, decision: "approve" | "block", note?: string) =>
    request<{ approval: ApprovalRequest }>(`/approvals/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    }),

  executeGatedAction: (approvalId: string, description?: string) =>
    request<{ approvalId: string; actionType: string; executed: boolean; executedAt: string }>(
      "/actions/execute",
      { method: "POST", body: JSON.stringify({ approvalId, description }) },
    ),

  createPacket: (input: { title: string; payload?: unknown; changeSummary?: string }) =>
    request<{ packet: Packet; version: number; sha256: string }>("/packets", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  addPacketVersion: (packetId: string, input: { payload?: unknown; changeSummary?: string }) =>
    request<{ packetId: string; version: number; sha256: string; parentSha256: string | null }>(
      `/packets/${packetId}/versions`,
      { method: "POST", body: JSON.stringify(input) },
    ),

  getPacket: (packetId: string) => request<{ packet: Packet }>(`/packets/${packetId}`),

  exportAudit: async (format: "json" | "csv" | "markdown" = "json") => {
    const res = await fetch(`${BASE}/audit/export?format=${format}`, {
      headers: { "X-Operator": "operator" },
    });
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    return res.text();
  },
};

export const EVIDENCE_KINDS = [
  "document",
  "image",
  "video",
  "audio",
  "data",
  "report",
  "contract",
  "receipt",
  "correspondence",
  "other",
] as const;

export const SOURCE_KINDS = [
  "statute",
  "regulation",
  "contract",
  "website",
  "correspondence",
  "court_order",
  "policy",
  "other",
] as const;

export const GATED_ACTION_TYPES = [
  "contract",
  "payment",
  "legal_conclusion",
  "external_submission",
  "destructive_change",
] as const;

export function approvalStatusMeta(status: string) {
  switch (status) {
    case "approved":
      return { label: "Approved", className: "border-emerald-300/25 bg-emerald-400/10 text-emerald-200", dot: "bg-emerald-400" };
    case "blocked":
      return { label: "Blocked", className: "border-red-300/25 bg-red-400/10 text-red-200", dot: "bg-red-400" };
    case "pending":
      return { label: "Pending", className: "border-amber-300/25 bg-amber-400/10 text-amber-200", dot: "bg-amber-400" };
    default:
      return { label: status, className: "border-white/10 bg-white/[0.06] text-white/70", dot: "bg-white/40" };
  }
}