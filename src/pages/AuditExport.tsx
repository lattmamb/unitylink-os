import { useState } from "react";
import { Download, FileJson, FileSpreadsheet, FileText, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { evidenceVault } from "@/lib/evidence-vault";

type Format = "json" | "csv" | "markdown";

const FORMATS: Array<{ id: Format; label: string; icon: typeof FileJson; hint: string }> = [
  { id: "json", label: "JSON", icon: FileJson, hint: "Full structured audit trail" },
  { id: "csv", label: "CSV", icon: FileSpreadsheet, hint: "Spreadsheet-friendly rows" },
  { id: "markdown", label: "Markdown", icon: FileText, hint: "Human-readable report" },
];

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AuditExport() {
  const [format, setFormat] = useState<Format>("json");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<{ format: Format; at: string } | null>(null);

  const exportAudit = async () => {
    setBusy(true);
    setError(null);
    try {
      const content = await evidenceVault.exportAudit(format);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const mime =
        format === "json" ? "application/json" : format === "csv" ? "text/csv" : "text/markdown";
      download(`unitylink-audit-${stamp}.${format === "markdown" ? "md" : format}`, content, mime);
      setLastExport({ format, at: new Date().toLocaleString() });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Export</h1>
        <p className="mt-1 text-sm text-white/45">
          Export the full evidence-vault audit trail — every upload, citation, approval decision, and gated execution — as a verifiable record.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-cyan-200/70" /> Export format
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={cn(
                "rounded-2xl border p-4 text-left transition",
                format === f.id
                  ? "border-cyan-300/30 bg-cyan-400/[0.06]"
                  : "border-white/[0.08] bg-black/15 hover:border-white/15",
              )}
            >
              <f.icon className={cn("h-5 w-5", format === f.id ? "text-cyan-200" : "text-white/40")} />
              <p className="mt-2 text-sm font-medium">{f.label}</p>
              <p className="mt-0.5 text-[11px] text-white/35">{f.hint}</p>
            </button>
          ))}
        </div>

        {error ? <p className="mt-4 text-xs text-red-300">{error}</p> : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={exportAudit} disabled={busy} className="bg-cyan-500/90 text-black hover:bg-cyan-400">
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
            Export audit trail
          </Button>
          {lastExport ? (
            <span className="text-xs text-white/40">
              Last export: {lastExport.format.toUpperCase()} at {lastExport.at}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/[0.06] bg-black/15 p-5">
        <h4 className="text-xs font-semibold text-white/70">What the export contains</h4>
        <ul className="mt-3 space-y-1.5 text-xs text-white/45">
          <li>· Evidence uploads with SHA-256 content hashes and vault paths</li>
          <li>· Source registrations and citation links</li>
          <li>· Approval requests, decisions (approve / block), and decision notes</li>
          <li>· Gated action executions with actor attribution</li>
          <li>· Packet versions with chained parent hashes</li>
        </ul>
      </div>
    </main>
  );
}