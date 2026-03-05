import { GlassCard } from "@/components/ui/glass-card";
import { CheckCircle, XCircle, AlertTriangle, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { apiGet, apiPost, setAuthToken } from "@/lib/api";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/async-state";

type CheckItem = { item: string; pass: boolean };

type AuditItem = {
  action: string;
  resource: string;
  resource_id?: string;
  details?: string;
  created_at: string;
};

export default function Auditoria() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [failedCount, setFailedCount] = useState<number | null>(null);
  const [verdict, setVerdict] = useState<"GO" | "NO-GO" | null>(null);
  const [logs, setLogs] = useState<AuditItem[]>([]);

  async function ensureTokenIfNeeded(errMessage: string) {
    if (!/401/.test(errMessage)) return false;
    try {
      const r = await apiPost<any>("/auth/dev-token?role=owner");
      if (r?.token) {
        setAuthToken(r.token);
        return true;
      }
    } catch {}
    return false;
  }

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [g, a] = await Promise.all([
        apiGet<any>("/ops/gonogo/checklist"),
        apiGet<any>("/audit/logs?limit=30"),
      ]);
      setChecks(g.checks || []);
      setFailedCount(typeof g.failed_count === "number" ? g.failed_count : 0);
      setVerdict(g.verdict || "NO-GO");
      setLogs(a.items || []);
    } catch (e: any) {
      const msg = String(e.message || e);
      const renewed = await ensureTokenIfNeeded(msg);
      if (renewed) {
        try {
          const [g, a] = await Promise.all([
            apiGet<any>("/ops/gonogo/checklist"),
            apiGet<any>("/audit/logs?limit=30"),
          ]);
          setChecks(g.checks || []);
          setFailedCount(typeof g.failed_count === "number" ? g.failed_count : 0);
          setVerdict(g.verdict || "NO-GO");
          setLogs(a.items || []);
          setError(null);
        } catch (e2: any) {
          setError(String(e2.message || e2));
        }
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  return (
    <div className="space-y-6 animate-in-fade">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">Auditoria & Saúde do Sistema</h1>
        <button onClick={loadAll} className="liquid-btn liquid-btn-primary flex items-center gap-2 text-xs">
          <Play className="h-3.5 w-3.5" /> Rodar GO/NO-GO
        </button>
      </div>

      {loading && <LoadingState label="Executando checklist GO/NO-GO..." />}
      {error && <ErrorState message={error} onRetry={loadAll} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="lg:col-span-2 !p-0 overflow-hidden">
          <div className="p-4 border-b border-border/30">
            <h3 className="text-sm font-semibold text-foreground">Linha do Tempo de Auditoria (dinâmica)</h3>
          </div>
          {logs.length === 0 ? (
            <div className="p-4"><EmptyState title="Sem eventos de auditoria recentes." /></div>
          ) : (
            <div className="divide-y divide-border/20 max-h-[420px] overflow-auto">
              {logs.map((entry, i) => {
                const type = /error|failed|fail/i.test(entry.action || "") ? "error" : /warn|review|queued/i.test(entry.action || "") ? "warning" : "info";
                return (
                  <div key={i} className="flex items-start gap-3 p-4">
                    <div className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${type === "error" ? "bg-destructive" : type === "warning" ? "bg-warning" : "bg-primary/50"}`} />
                    <div className="flex-1">
                      <p className="text-sm text-foreground">{entry.action} · {entry.resource}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">{entry.resource_id || "--"}</span>
                        <span className="text-[10px] text-muted-foreground/50">•</span>
                        <span className="text-[10px] text-muted-foreground">{(entry.created_at || "").replace("T", " ").slice(0, 19)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>

        <GlassCard>
          <h3 className="text-sm font-semibold text-foreground mb-4">Checklist GO/NO-GO (dinâmica)</h3>
          {checks.length === 0 ? (
            <EmptyState title="Sem dados de checklist." />
          ) : (
            <div className="space-y-2.5">
              {checks.map((c, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  {c.pass ? (
                    <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  )}
                  <span className={`text-xs ${c.pass ? "text-foreground" : "text-destructive"}`}>{c.item}</span>
                </div>
              ))}
            </div>
          )}

          <div className={`mt-4 p-3 rounded-xl border ${verdict === "GO" ? "bg-success/10 border-success/20" : verdict === "NO-GO" ? "bg-warning/10 border-warning/20" : "bg-secondary/20 border-border/30"}`}>
            <p className={`text-xs font-medium ${verdict === "GO" ? "text-success" : verdict === "NO-GO" ? "text-warning" : "text-muted-foreground"}`}>
              {verdict === "GO"
                ? "✅ GO — todos os checks passaram"
                : verdict === "NO-GO"
                  ? `⚠️ NO-GO — ${failedCount ?? 0} itens falharam`
                  : "Sem veredito ainda"}
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
