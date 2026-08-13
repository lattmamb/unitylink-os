import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock,
  FileText,
  Flag,
  FolderKanban,
  Gauge,
  GitBranch,
  Layers3,
  Link2,
  ListChecks,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Target,
  Users2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  controlPlane,
  statusMeta,
  timeAgo,
  type ActivityEvent,
  type AgentSummary,
  type ApprovalSummary,
  type IssueDetail,
  type IssueSummary,
  type Overview,
  type ProjectSummary,
} from "@/lib/control-plane";

type Tab = "issues" | "projects" | "approvals" | "agents" | "activity";

const TABS: Array<{ id: Tab; label: string; icon: typeof ListChecks }> = [
  { id: "issues", label: "Issues", icon: ListChecks },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "approvals", label: "Approvals", icon: ShieldCheck },
  { id: "agents", label: "Agents", icon: Users2 },
  { id: "activity", label: "Audit history", icon: Activity },
];

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: number | string; icon: typeof Gauge; accent?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/40">{label}</p>
        <Icon className={cn("h-4 w-4", accent || "text-white/35")} />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium", meta.className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    critical: "border-red-400/25 bg-red-400/10 text-red-300",
    high: "border-amber-300/25 bg-amber-300/10 text-amber-200",
    medium: "border-white/10 bg-white/[0.06] text-white/70",
    low: "border-white/10 bg-white/[0.04] text-white/50",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize", map[priority] || map.medium)}>
      {priority}
    </span>
  );
}

function IssueRow({ issue, onOpen }: { issue: IssueSummary; onOpen: (id: string) => void }) {
  return (
    <button
      onClick={() => onOpen(issue.id)}
      className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2.5 text-left transition hover:border-white/15 hover:bg-white/[0.04]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-cyan-200/70">{issue.identifier}</span>
          <span className="truncate text-sm font-medium">{issue.title}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-white/35">
          <StatusBadge status={issue.status} />
          <PriorityBadge priority={issue.priority} />
          {issue.project ? <span className="inline-flex items-center gap-1"><FolderKanban className="h-3 w-3" />{issue.project}</span> : null}
          {issue.blockedBy.length > 0 ? (
            <span className="inline-flex items-center gap-1 text-red-300/80">
              <AlertTriangle className="h-3 w-3" />
              blocked by {issue.blockedBy.map((b) => b.identifier).join(", ")}
            </span>
          ) : null}
          <span className="ml-auto inline-flex items-center gap-1 text-white/30">
            <Clock className="h-3 w-3" />
            {timeAgo(issue.updatedAt)}
          </span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-white/20 transition group-hover:text-white/50" />
    </button>
  );
}

function IssueDetailPanel({ issueId, onBack }: { issueId: string; onBack: () => void }) {
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setIssue(null);
    setError(null);
    controlPlane
      .issue(issueId)
      .then((d) => alive && setIssue(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [issueId]);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-6 text-sm text-red-200">
        Failed to load issue: {error}
        <Button variant="outline" size="sm" className="mt-3 border-white/10 bg-black/20" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to list
        </Button>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.02] p-16 text-white/40">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading record…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="text-white/50" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to dashboard
        </Button>
        <span className="font-mono text-xs text-cyan-200/60">{issue.identifier}</span>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={issue.status} />
          <PriorityBadge priority={issue.priority} />
          {issue.labels.map((l) => (
            <Badge key={l} className="border-white/10 bg-white/[0.05] text-white/60">{l}</Badge>
          ))}
        </div>
        <h2 className="mt-3 text-xl font-semibold tracking-tight">{issue.title}</h2>
        {issue.description ? (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/55">{issue.description}</p>
        ) : (
          <p className="mt-2 text-sm text-white/30">No description.</p>
        )}
        <div className="mt-4 grid gap-3 text-xs text-white/45 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <p className="text-white/30">Project</p>
            <p className="mt-1 font-medium text-white/75">{issue.project || "—"}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <p className="text-white/30">Created</p>
            <p className="mt-1 font-medium text-white/75">{new Date(issue.createdAt).toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <p className="text-white/30">Updated</p>
            <p className="mt-1 font-medium text-white/75">{new Date(issue.updatedAt).toLocaleString()}</p>
          </div>
          {issue.completedAt ? (
            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
              <p className="text-white/30">Completed</p>
              <p className="mt-1 font-medium text-white/75">{new Date(issue.completedAt).toLocaleString()}</p>
            </div>
          ) : null}
          {issue.billingCode ? (
            <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
              <p className="text-white/30">Billing code</p>
              <p className="mt-1 font-mono font-medium text-white/75">{issue.billingCode}</p>
            </div>
          ) : null}
        </div>
      </div>

      {issue.blockedBy.length > 0 ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-300/80">
            <Link2 className="h-3.5 w-3.5" /> Blocked by
          </p>
          <div className="mt-2 space-y-1.5">
            {issue.blockedBy.map((b) => (
              <div key={b.id} className="flex items-center gap-2 text-sm">
                <span className="font-mono text-[11px] text-red-300/70">{b.identifier}</span>
                <span className="text-white/70">{b.title}</span>
                <StatusBadge status={b.status} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {issue.ancestors.length > 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/35">Ancestors</p>
          <div className="mt-2 space-y-1.5">
            {issue.ancestors.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-sm">
                <span className="font-mono text-[11px] text-cyan-200/60">{a.identifier}</span>
                <span className="text-white/70">{a.title}</span>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {issue.documents.length > 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/35">
            <FileText className="h-3.5 w-3.5" /> Documents ({issue.documents.length})
          </p>
          <div className="mt-2 space-y-1.5">
            {issue.documents.map((d) => (
              <div key={d.key} className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-black/15 px-3 py-2 text-sm">
                <span className="font-mono text-[11px] text-cyan-200/70">{d.key}</span>
                <span className="text-white/70">{d.title}</span>
                <span className="text-[11px] text-white/35">{d.format}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {issue.workProducts.length > 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/35">Work products ({issue.workProducts.length})</p>
          <div className="mt-2 space-y-1.5">
            {issue.workProducts.map((w) => (
              <div key={w.id} className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-black/15 px-3 py-2 text-sm">
                <span className="text-white/70">{w.title}</span>
                <Badge className="border-white/10 bg-white/[0.05] text-white/50">{w.kind}</Badge>
                {w.url ? (
                  <a href={w.url} target="_blank" rel="noreferrer" className="ml-auto text-[11px] text-cyan-200/70 hover:underline">
                    open ↗
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/35">Comments ({issue.comments.length})</p>
        <div className="mt-2 max-h-80 space-y-2 overflow-y-auto pr-1">
          {issue.comments.length === 0 ? (
            <p className="text-sm text-white/30">No comments.</p>
          ) : (
            issue.comments.map((c) => (
              <div key={c.id} className="rounded-xl border border-white/[0.05] bg-black/15 p-3">
                <div className="flex items-center gap-2 text-[11px] text-white/35">
                  <span className="font-medium text-white/55">{c.authorAgentId ? "agent" : "user"}</span>
                  <span>{timeAgo(c.createdAt)}</span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-white/65">{c.body}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function ControlPlane() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [issues, setIssues] = useState<IssueSummary[]>([]);
  const [approvals, setApprovals] = useState<ApprovalSummary[]>([]);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<Tab>("issues");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [ov, pr, is, ap, ag, ac] = await Promise.all([
        controlPlane.overview(),
        controlPlane.projects(),
        controlPlane.issues(),
        controlPlane.approvals(),
        controlPlane.agents(),
        controlPlane.activity(60),
      ]);
      setOverview(ov);
      setProjects(pr.projects);
      setIssues(is.issues);
      setApprovals(ap.approvals);
      setAgents(ag.agents);
      setActivity(ac.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredIssues = useMemo(
    () => (statusFilter ? issues.filter((i) => i.status === statusFilter) : issues),
    [issues, statusFilter]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of issues) counts[i.status] = (counts[i.status] || 0) + 1;
    return counts;
  }, [issues]);

  const blockedIssues = useMemo(() => issues.filter((i) => i.status === "blocked" || i.blockedBy.length > 0), [issues]);

  if (selectedIssueId) {
    return (
      <main className="min-h-screen bg-[#050608] text-white">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_-10%,rgba(30,220,255,.12),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(64,255,187,.07),transparent_26%)]" />
        <div className="relative mx-auto max-w-4xl px-4 py-6 lg:px-6">
          <IssueDetailPanel issueId={selectedIssueId} onBack={() => setSelectedIssueId(null)} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050608] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_-10%,rgba(30,220,255,.12),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(64,255,187,.07),transparent_26%)]" />
      <div className="relative mx-auto max-w-[1500px] px-4 py-6 lg:px-7">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-cyan-200/60">
              <Building2 className="h-4 w-4" />
              {overview?.company.name || "Unity Link"} · Paperclip control plane
            </div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight lg:text-4xl">Operations dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
              Live read-only view of the company control plane — projects, issues, blockers, approvals, agents, and audit history.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {overview ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Live · {timeAgo(overview.updatedAt)}
              </span>
            ) : null}
            <Button variant="outline" className="border-white/10 bg-white/[0.04]" onClick={load} disabled={refreshing}>
              <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} /> Refresh
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-5 text-sm text-red-200">
            <p className="font-medium">Bridge error</p>
            <p className="mt-1 text-red-200/70">{error}</p>
            <p className="mt-2 text-xs text-red-200/50">
              Start the bridge with <code className="rounded bg-black/30 px-1.5 py-0.5">node server/control-plane.mjs</code> (needs PAPERCLIP_API_URL and PAPERCLIP_API_KEY).
            </p>
          </div>
        ) : null}

        {loading ? (
          <div className="mt-16 flex items-center justify-center text-white/40">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading control plane…
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <StatCard label="Projects" value={overview?.counts.projects ?? 0} icon={FolderKanban} accent="text-cyan-300" />
              <StatCard label="Issues" value={overview?.counts.issues ?? 0} icon={ListChecks} />
              <StatCard label="Blocked" value={blockedIssues.length} icon={AlertTriangle} accent="text-red-300" />
              <StatCard label="Approvals" value={overview?.counts.approvals ?? 0} icon={ShieldCheck} accent="text-emerald-300" />
              <StatCard label="Agents" value={overview?.counts.agents ?? 0} icon={Users2} />
              <StatCard label="Goals" value={overview?.counts.goals ?? 0} icon={Target} />
            </div>

            {/* Status strip */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setStatusFilter("")}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition",
                  !statusFilter ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-200" : "border-white/10 bg-white/[0.03] text-white/50 hover:text-white/80"
                )}
              >
                All ({issues.length})
              </button>
              {Object.entries(statusCounts).map(([status, count]) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(statusFilter === status ? "" : status)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition",
                    statusFilter === status ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-200" : "border-white/10 bg-white/[0.03] text-white/50 hover:text-white/80"
                  )}
                >
                  {statusMeta(status).label} ({count})
                </button>
              ))}
            </div>

            {/* Tabs */}
            <div className="mt-6 flex flex-wrap gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setView(t.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm transition",
                    view === t.id ? "bg-white/[0.08] text-white" : "text-white/45 hover:text-white/80"
                  )}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Issues */}
            {view === "issues" ? (
              <div className="mt-5 space-y-2">
                {filteredIssues.length === 0 ? (
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center text-sm text-white/35">
                    No issues in this view.
                  </div>
                ) : (
                  filteredIssues.map((i) => <IssueRow key={i.id} issue={i} onOpen={setSelectedIssueId} />)
                )}
              </div>
            ) : null}

            {/* Projects */}
            {view === "projects" ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {projects.length === 0 ? (
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center text-white/40">No projects.</div>
                ) : (
                  projects.map((p) => (
                    <div key={p.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                      <div className="flex items-center justify-between">
                        <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-black/20">
                          <FolderKanban className="h-4 w-4 text-cyan-200/70" />
                        </div>
                        <Badge className={cn("border-white/10", p.status === "in_progress" ? "bg-cyan-300/10 text-cyan-200" : "bg-white/[0.05] text-white/50")}>
                          {p.status}
                        </Badge>
                      </div>
                      <h3 className="mt-3 font-medium">{p.name}</h3>
                      <p className="mt-1 text-xs text-white/35">
                        {p.counts.total} issues · {p.counts.open} open · {p.counts.blocked} blocked · {p.counts.done} done
                      </p>
                      <div className="mt-3 h-1.5 rounded-full bg-white/5">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            p.counts.blocked > 0 ? "bg-gradient-to-r from-red-400 to-amber-300" : "bg-gradient-to-r from-cyan-300 to-emerald-300"
                          )}
                          style={{ width: `${p.counts.total ? Math.round((p.counts.done / p.counts.total) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}

            {/* Approvals */}
            {view === "approvals" ? (
              <div className="mt-5 space-y-2">
                {approvals.length === 0 ? (
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center text-white/40">
                    No approvals. Approvals requested by agents appear here for operator review.
                  </div>
                ) : (
                  approvals.map((a) => (
                    <div key={a.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-300/80" />
                        <span className="text-sm font-medium">{a.title}</span>
                        <Badge className={cn("border-white/10", a.status === "pending" ? "bg-amber-300/10 text-amber-200" : "bg-white/[0.05] text-white/50")}>
                          {a.status}
                        </Badge>
                        <span className="ml-auto text-[11px] text-white/30">{timeAgo(a.createdAt)}</span>
                      </div>
                      {a.summary ? <p className="mt-2 text-sm leading-6 text-white/50">{a.summary}</p> : null}
                      {a.recommendedAction ? (
                        <p className="mt-1.5 text-xs text-white/40">
                          <span className="text-white/60">Recommended:</span> {a.recommendedAction}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            ) : null}

            {/* Agents */}
            {view === "agents" ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {agents.length === 0 ? (
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center text-white/40">No agents.</div>
                ) : (
                  agents.map((a) => (
                    <div key={a.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-cyan-300 to-emerald-300 text-xs font-bold text-black">
                          {a.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{a.name}</p>
                          <p className="truncate text-[11px] text-white/35">{a.role}{a.title ? ` · ${a.title}` : ""}</p>
                        </div>
                        <span
                          className={cn(
                            "ml-auto inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]",
                            a.status === "running"
                              ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
                              : "border-white/10 bg-white/[0.04] text-white/50"
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", a.status === "running" ? "bg-emerald-300" : "bg-white/30")} />
                          {a.status}
                        </span>
                      </div>
                      <p className="mt-3 text-[11px] text-white/30">Last heartbeat: {timeAgo(a.lastHeartbeatAt)}</p>
                    </div>
                  ))
                )}
              </div>
            ) : null}

            {/* Activity */}
            {view === "activity" ? (
              <div className="mt-5 space-y-1.5">
                {activity.length === 0 ? (
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center text-white/40">No activity recorded.</div>
                ) : (
                  activity.map((e) => (
                    <div key={e.id} className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-black/15 px-3 py-2.5">
                      <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white/70">
                          <span className="font-medium text-white/85">{e.action}</span>
                          <span className="text-white/35"> on {e.entityType}</span>
                          {e.entityId ? <span className="ml-1 font-mono text-[11px] text-cyan-200/50">{e.entityId.slice(0, 8)}</span> : null}
                        </p>
                        <p className="mt-0.5 text-[11px] text-white/30">
                          {e.actorType} · {timeAgo(e.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}