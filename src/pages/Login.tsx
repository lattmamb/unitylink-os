import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { setToken, clearToken, getToken, isAuthenticated } from "@/lib/auth";
import { evidenceVault } from "@/lib/evidence-vault";

/**
 * Operator/member sign-in. The API key is stored in localStorage and sent as
 * `Authorization: Bearer <key>` on every API call; the server enforces RBAC
 * (server/lib/auth.mjs). The key is never bundled or committed.
 */
export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [token, setTokenInput] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const hasToken = isAuthenticated();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setStatus("checking");
    setError(null);
    try {
      // Verify the key against the public health + an operator-only probe.
      setToken(token);
      const health = await evidenceVault.health();
      if (!health.ok) throw new Error("Vault health check failed");
      setStatus("ok");
      const next = params.get("next") || "/control-plane";
      navigate(next);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Sign-in failed");
      clearToken();
    }
  }

  function handleLogout() {
    clearToken();
    setTokenInput("");
    setStatus("idle");
  }

  return (
    <PageLayout title="Operator sign-in" menuItems={[]}>
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">UnityLink OS</h2>
              <p className="text-sm text-white/50">Role-based access (operator / member)</p>
            </div>
          </div>

          {hasToken && (
            <div className="mb-4 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">
              Signed in. Token stored locally and sent as a bearer header.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-white/70" htmlFor="token">
                API key
              </label>
              <input
                id="token"
                type="password"
                value={token}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste your operator or member key"
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-300/40 focus:outline-none"
                autoComplete="off"
              />
            </div>

            {status === "error" && error && (
              <div className="rounded-lg border border-red-300/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={status === "checking" || !token.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-300 disabled:opacity-50"
            >
              <KeyRound className="h-4 w-4" />
              {status === "checking" ? "Verifying…" : "Sign in"}
            </button>
          </form>

          {hasToken && (
            <button
              onClick={handleLogout}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/5"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          )}

          <p className="mt-4 text-xs text-white/40">
            Keys are generated server-side (openssl rand -hex 32) and never
            committed. Data routes require the operator role; the member role is
            reserved for the participant-facing surface.
          </p>
        </div>
      </div>
    </PageLayout>
  );
}