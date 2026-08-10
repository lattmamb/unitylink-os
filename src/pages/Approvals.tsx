import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  LoaderCircle,
  Lock,
  Play,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  evidenceVault,
  GATED_ACTION_TYPES,
  approvalStatusMeta,
  type ApprovalRequest,
} from "@/lib/evidence-vault";

function ActionTypeBadge({ type }: { type: string }) {
  return (
    <Badge className="border-white/10 bg-white/[0.05] text-white/60 capitalize">
      {type.replace("_", " ")}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = approvalStatusMeta(status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium", meta.className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

function RequestForm({ onCreated }: { onCreated: () => void }) {
  const [actionType, setActionType] = useState<string>("payment");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await evidenceVault.requestApproval({
        actionType,
        title,
        description: description || undefined,
      });
      setTitle("");
      setDescription("");
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Lock className="h-4 w-4 text-cyan-200/70" /> Request approval gate
      </h3>
      <p className="mt-1 text-xs text-white/40">
        Gated actions (contract, payment, legal conclusion, external submission, destructive change) require human approval before execution.
      </p>
      <div className="mt-4 grid gap-3">
        <div>
          <Label className="text-xs text-white/50">Action type</Label>
          <Select value={actionType} onValueChange={setActionType}>
            <SelectTrigger className="mt-1 border-white/10 bg-black/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GATED_ACTION_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-white/50">Title *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Release payment tranche 2" className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div>
          <Label className="text-xs text-white/50">Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is being executed and why?" className="mt-1 border-white/10 bg-black/20" />
        </div>
      </div>
      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
      <Button onClick={submit} disabled={busy || !title} className="mt-4 bg-cyan-500/90 text-black hover:bg-cyan-400">
        {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Lock className="mr-1.5 h-3.5 w-3.5" />}
        Request approval
      </Button>
    </div>
  );
}

function ApprovalRow({
  approval,
  onDecide,
  onDecided,
}: {
  approval: ApprovalRequest;
  onDecide: (id: string, decision: "approve" | "block", note?: string) => Promise<void>;
  onDecided: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decide = async (decision: "approve" | "block") => {
    setBusy(true);
    setError(null);
    try {
      await onDecide(approval.id, decision, note || undefined);
      onDecided();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const execute = async () => {
    setExecuting(true);
    setError(null);
    try {
      await evidenceVault.executeGatedAction(approval.id, "Executed from approvals UI");
      onDecided();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/15 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{approval.title}</span>
        <ActionTypeBadge type={approval.actionType} />
        <StatusBadge status={approval.status} />
      </div>
      {approval.description ? <p className="mt-1.5 text-xs text-white/45">{approval.description}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/35">
        <span>Requested by {approval.requestedBy}</span>
        <span>· {new Date(approval.createdAt).toLocaleString()}</span>
        {approval.decidedBy ? (
          <span>· Decided by {approval.decidedBy} {approval.decidedAt ? `at ${new Date(approval.decidedAt).toLocaleString()}` : ""}</span>
        ) : null}
        {approval.decisionNote ? <span className="text-cyan-200/60">· “{approval.decisionNote}”</span> : null}
      </div>

      {approval.status === "pending" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Decision note (optional)"
            className="h-8 w-56 border-white/10 bg-black/20 text-xs"
          />
          <Button size="sm" onClick={() => decide("approve")} disabled={busy} className="bg-emerald-500/90 text-black hover:bg-emerald-400">
            {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
            Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => decide("block")} disabled={busy} className="border-red-400/30 bg-red-400/10 text-red-200 hover:bg-red-400/20">
            {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <XCircle className="mr-1 h-3.5 w-3.5" />}
            Block
          </Button>
        </div>
      ) : null}

      {approval.status === "approved" ? (
        <div className="mt-3">
          <Button size="sm" onClick={execute} disabled={executing} className="bg-cyan-500/90 text-black hover:bg-cyan-400">
            {executing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}
            Execute gated action
          </Button>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

export default function Approvals() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await evidenceVault.listApprovals(filter === "all" ? undefined : filter);
      setApprovals(res.approvals);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const decide = useCallback(async (id: string, decision: "approve" | "block", note?: string) => {
    await evidenceVault.decideApproval(id, decision, note);
  }, []);

  const counts = useCallback((list: ApprovalRequest[]) => ({
    all: list.length,
    pending: list.filter((a) => a.status === "pending").length,
    approved: list.filter((a) => a.status === "approved").length,
    blocked: list.filter((a) => a.status === "blocked").length,
  }), []);

  const FILTERS = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "approved", label: "Approved" },
    { id: "blocked", label: "Blocked" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Approval Gates</h1>
          <p className="mt-1 text-sm text-white/45">
            Human-in-the-loop gates for contract, payment, legal, external submission, and destructive actions.
          </p>
        </div>
        <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                filter === f.id ? "bg-white/10 text-white" : "text-white/45 hover:text-white/70",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/40">Total</p>
            <ShieldCheck className="h-4 w-4 text-white/35" />
          </div>
          <p className="mt-2 text-2xl font-semibold">{counts(approvals).all}</p>
        </div>
        <div className="rounded-2xl border border-amber-300/20 bg-amber-400/[0.04] p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-amber-200/60">Pending</p>
            <LoaderCircle className="h-4 w-4 text-amber-200/50" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-amber-100">{counts(approvals).pending}</p>
        </div>
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.04] p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-emerald-200/60">Approved</p>
            <CheckCircle2 className="h-4 w-4 text-emerald-200/50" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-emerald-100">{counts(approvals).approved}</p>
        </div>
        <div className="rounded-2xl border border-red-300/20 bg-red-400/[0.04] p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-red-200/60">Blocked</p>
            <ShieldAlert className="h-4 w-4 text-red-200/50" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-red-100">{counts(approvals).blocked}</p>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-4 text-sm text-red-200">
          {error}
          <Button variant="outline" size="sm" className="ml-3 border-white/10 bg-black/20" onClick={refresh}>
            Retry
          </Button>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.02] p-16 text-white/40">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading approvals…
            </div>
          ) : approvals.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-16 text-center text-sm text-white/35">
              No approval requests{filter !== "all" ? ` with status “${filter}”` : ""} yet.
            </div>
          ) : (
            approvals.map((a) => (
              <ApprovalRow key={a.id} approval={a} onDecide={decide} onDecided={refresh} />
            ))
          )}
        </div>
        <RequestForm onCreated={refresh} />
      </div>
    </main>
  );
}