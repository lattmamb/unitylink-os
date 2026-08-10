import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText,
  Link2,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Upload,
  X,
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
  EVIDENCE_KINDS,
  SOURCE_KINDS,
  type EvidenceItem,
  type Source,
  type AuditEvent,
} from "@/lib/evidence-vault";

type Tab = "evidence" | "sources" | "provenance";

function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: typeof FileText }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/40">{label}</p>
        <Icon className="h-4 w-4 text-white/35" />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function KindBadge({ kind }: { kind: string }) {
  return (
    <Badge className="border-white/10 bg-white/[0.05] text-white/60 capitalize">{kind}</Badge>
  );
}

function EvidenceRow({ item, onOpen }: { item: EvidenceItem; onOpen: (id: string) => void }) {
  return (
    <button
      onClick={() => onOpen(item.id)}
      className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2.5 text-left transition hover:border-white/15 hover:bg-white/[0.04]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{item.title}</span>
          <KindBadge kind={item.kind} />
          {item.status !== "active" ? (
            <Badge className="border-amber-300/25 bg-amber-400/10 text-amber-200">{item.status}</Badge>
          ) : null}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-white/35">
          <span className="font-mono text-cyan-200/60">{item.sha256.slice(0, 16)}…</span>
          {item.fileName ? <span>{item.fileName}</span> : null}
          {item.tags.map((t) => (
            <span key={t} className="rounded-full border border-white/[0.06] px-1.5 py-0.5">#{t}</span>
          ))}
          <span className="ml-auto">{new Date(item.createdAt).toLocaleString()}</span>
        </div>
      </div>
    </button>
  );
}

function UploadForm({ onUploaded }: { onUploaded: () => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<string>("document");
  const [description, setDescription] = useState("");
  const [fileName, setFileName] = useState("");
  const [tags, setTags] = useState("");
  const [contentBase64, setContentBase64] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setContentBase64(result.split(",")[1] ?? "");
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await evidenceVault.uploadEvidence({
        title,
        kind,
        description: description || undefined,
        fileName: fileName || undefined,
        contentBase64,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      setTitle("");
      setDescription("");
      setFileName("");
      setTags("");
      setContentBase64("");
      onUploaded();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Upload className="h-4 w-4 text-cyan-200/70" /> Upload evidence
      </h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label className="text-xs text-white/50">Title *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Executed site control agreement" className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div>
          <Label className="text-xs text-white/50">Kind</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="mt-1 border-white/10 bg-black/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVIDENCE_KINDS.map((k) => (
                <SelectItem key={k} value={k} className="capitalize">{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-white/50">File</Label>
          <Input
            type="file"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="mt-1 border-white/10 bg-black/20 file:text-white/60"
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs text-white/50">Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this evidence support?" className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs text-white/50">Tags (comma separated)</Label>
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="site, contract, revenue" className="mt-1 border-white/10 bg-black/20" />
        </div>
      </div>
      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
      <Button
        onClick={submit}
        disabled={busy || !title || !contentBase64}
        className="mt-4 bg-cyan-500/90 text-black hover:bg-cyan-400"
      >
        {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
        Upload to vault
      </Button>
    </div>
  );
}

function SourceForm({ onAdded }: { onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<string>("statute");
  const [url, setUrl] = useState("");
  const [citation, setCitation] = useState("");
  const [authority, setAuthority] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await evidenceVault.addSource({
        title,
        kind,
        url: url || undefined,
        citation: citation || undefined,
        authority: authority || undefined,
      });
      setTitle("");
      setUrl("");
      setCitation("");
      setAuthority("");
      onAdded();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Link2 className="h-4 w-4 text-cyan-200/70" /> Register cited source
      </h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label className="text-xs text-white/50">Title *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="30 ILCS 105/5.878" className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div>
          <Label className="text-xs text-white/50">Kind</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="mt-1 border-white/10 bg-black/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_KINDS.map((k) => (
                <SelectItem key={k} value={k} className="capitalize">{k.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-white/50">Authority</Label>
          <Input value={authority} onChange={(e) => setAuthority(e.target.value)} placeholder="Illinois General Assembly" className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs text-white/50">Citation</Label>
          <Input value={citation} onChange={(e) => setCitation(e.target.value)} placeholder="30 ILCS 105/5.878" className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs text-white/50">URL</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://ilga.gov" className="mt-1 border-white/10 bg-black/20" />
        </div>
      </div>
      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
      <Button onClick={submit} disabled={busy || !title} className="mt-4 bg-cyan-500/90 text-black hover:bg-cyan-400">
        {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
        Register source
      </Button>
    </div>
  );
}

function CiteForm({ evidenceId, sources, onCited }: { evidenceId: string; sources: Source[]; onCited: () => void }) {
  const [sourceId, setSourceId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await evidenceVault.addCitation(evidenceId, sourceId, note || undefined);
      setSourceId("");
      setNote("");
      onCited();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
      <h4 className="flex items-center gap-2 text-xs font-semibold text-white/70">
        <Link2 className="h-3.5 w-3.5 text-cyan-200/70" /> Link provenance / source citation
      </h4>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Select value={sourceId} onValueChange={setSourceId}>
          <SelectTrigger className="border-white/10 bg-black/20">
            <SelectValue placeholder="Select source…" />
          </SelectTrigger>
          <SelectContent>
            {sources.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (e.g. backs the revenue line)" className="border-white/10 bg-black/20" />
        <Button onClick={submit} disabled={busy || !sourceId} size="sm" className="bg-cyan-500/90 text-black hover:bg-cyan-400">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

function ProvenancePanel({ item, events }: { item: EvidenceItem; events: AuditEvent[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">{item.title}</h3>
          <KindBadge kind={item.kind} />
        </div>
        {item.description ? <p className="mt-2 text-sm text-white/55">{item.description}</p> : null}
        <div className="mt-3 grid gap-2 text-xs text-white/45 sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <p className="text-white/30">SHA-256</p>
            <p className="mt-1 break-all font-mono text-cyan-200/70">{item.sha256}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <p className="text-white/30">Vault path</p>
            <p className="mt-1 break-all font-mono text-white/60">{item.vaultPath}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
        <h4 className="text-xs font-semibold text-white/70">Provenance / audit trail</h4>
        <div className="mt-3 space-y-2">
          {events.map((e) => (
            <div key={e.id} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2 text-xs">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-200/60" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white/75">
                  <span className="font-mono text-cyan-200/70">{e.action}</span>
                  <span className="text-white/35"> · {e.actor}</span>
                </p>
                {e.reason ? <p className="mt-0.5 text-white/45">{e.reason}</p> : null}
                {e.detail ? <p className="mt-0.5 break-all font-mono text-[10px] text-white/30">{e.detail}</p> : null}
              </div>
              <span className="shrink-0 text-white/30">{new Date(e.created_at).toLocaleString()}</span>
            </div>
          ))}
          {events.length === 0 ? <p className="text-xs text-white/30">No audit events yet.</p> : null}
        </div>
      </div>
    </div>
  );
}

export default function EvidenceVault() {
  const [tab, setTab] = useState<Tab>("evidence");
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [selected, setSelected] = useState<EvidenceItem | null>(null);
  const [provenance, setProvenance] = useState<AuditEvent[]>([]);
  const [citations, setCitations] = useState<Array<{ id: string; source_id: string; note: string | null }>>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ev, src] = await Promise.all([evidenceVault.listEvidence(), evidenceVault.listSources()]);
      setEvidence(ev.evidence);
      setSources(src.sources);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openEvidence = useCallback(async (id: string) => {
    setError(null);
    try {
      const [prov, cites] = await Promise.all([evidenceVault.provenance(id), evidenceVault.listCitations(id)]);
      const item = evidence.find((e) => e.id === id) ?? null;
      setSelected(item);
      setProvenance(prov.provenance);
      setCitations(cites.citations);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [evidence]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return evidence;
    return evidence.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.fileName?.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [evidence, query]);

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: "evidence", label: "Evidence vault" },
    { id: "sources", label: "Cited sources" },
    { id: "provenance", label: "Provenance" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Evidence Vault</h1>
          <p className="mt-1 text-sm text-white/45">
            File vault with SHA-256 content addressing, source citations, and provenance for the UnityLink Commonwealth pilot.
          </p>
        </div>
        <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                tab === t.id ? "bg-white/10 text-white" : "text-white/45 hover:text-white/70",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Evidence items" value={evidence.length} icon={FileText} />
        <StatCard label="Cited sources" value={sources.length} icon={Link2} />
        <StatCard label="Citations" value={citations.length} icon={ShieldCheck} />
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-4 text-sm text-red-200">
          {error}
          <Button variant="outline" size="sm" className="ml-3 border-white/10 bg-black/20" onClick={refresh}>
            Retry
          </Button>
        </div>
      ) : null}

      {tab === "evidence" && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search evidence by title, file, or tag…"
                className="border-white/10 bg-black/20 pl-9"
              />
            </div>
            {loading ? (
              <div className="flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.02] p-16 text-white/40">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading vault…
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-16 text-center text-sm text-white/35">
                No evidence in the vault yet. Upload a document to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((item) => (
                  <EvidenceRow key={item.id} item={item} onOpen={openEvidence} />
                ))}
              </div>
            )}
          </div>
          <div className="space-y-4">
            <UploadForm onUploaded={refresh} />
            {selected ? (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-white/70">Cite: {selected.title}</h4>
                  <button onClick={() => setSelected(null)} className="text-white/40 hover:text-white/70">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3">
                  <CiteForm evidenceId={selected.id} sources={sources} onCited={refresh} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {tab === "sources" && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="space-y-2">
            {sources.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-16 text-center text-sm text-white/35">
                No cited sources registered yet.
              </div>
            ) : (
              sources.map((s) => (
                <div key={s.id} className="rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{s.title}</span>
                    <KindBadge kind={s.kind} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-white/35">
                    {s.citation ? <span className="font-mono text-cyan-200/60">{s.citation}</span> : null}
                    {s.authority ? <span>{s.authority}</span> : null}
                    {s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="text-cyan-200/70 hover:underline">{s.url}</a> : null}
                  </div>
                </div>
              ))
            )}
          </div>
          <SourceForm onAdded={refresh} />
        </div>
      )}

      {tab === "provenance" && (
        <div className="mt-6">
          {selected ? (
            <ProvenancePanel item={selected} events={provenance} />
          ) : (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-16 text-center text-sm text-white/35">
              Select an evidence item to view its provenance and audit trail.
            </div>
          )}
        </div>
      )}
    </main>
  );
}