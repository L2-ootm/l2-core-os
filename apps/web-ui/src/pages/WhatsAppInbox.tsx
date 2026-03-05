import { GlassCard } from "@/components/ui/glass-card";
import { StatusPill } from "@/components/ui/status-pill";
import { Send, Phone, Calendar, Search, RefreshCw, Link2Off } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiGet, waGet, waPost, apiPost, setAuthToken } from "@/lib/api";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/async-state";

type HRItem = {
  id: string;
  source: string;
  reference_id?: string;
  text?: string;
  status: string;
  created_at: string;
};

export default function WhatsAppInbox() {
  const [selected, setSelected] = useState(0);
  const [waStatus, setWaStatus] = useState<any>(null);
  const [classes, setClasses] = useState<any>(null);
  const [humanQueue, setHumanQueue] = useState<HRItem[]>([]);
  const [out, setOut] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWaModal, setShowWaModal] = useState(false);
  const [qrNonce, setQrNonce] = useState(Date.now());

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

  async function refresh() {
    setError(null);
    try {
      const [w, c, h] = await Promise.all([
        waGet<any>("/session/status"),
        apiGet<any>("/ops/leads/classifications"),
        apiGet<any>("/human-review/list?status=pending&limit=200"),
      ]);
      setWaStatus(w);
      setClasses(c.classifications);
      setHumanQueue(h.items || []);
      setSelected(0);
    } catch (e: any) {
      const msg = String(e.message || e);
      const renewed = await ensureTokenIfNeeded(msg);
      if (renewed) {
        try {
          const [w, c, h] = await Promise.all([
            waGet<any>("/session/status"),
            apiGet<any>("/ops/leads/classifications"),
            apiGet<any>("/human-review/list?status=pending&limit=200"),
          ]);
          setWaStatus(w);
          setClasses(c.classifications);
          setHumanQueue(h.items || []);
          return;
        } catch {}
      }
      setError(msg);
      setOut({ error: msg });
    }
  }

  useEffect(() => { refresh(); }, []);

  async function openConnectModal() {
    setLoading(true); setError(null);
    try {
      await waPost<any>("/session/connect");
      setQrNonce(Date.now());
      setShowWaModal(true);
      await refresh();
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function action(kind: "catchup" | "disconnect") {
    setLoading(true); setError(null);
    try {
      const r = kind === "catchup"
        ? await waPost<any>("/session/catchup")
        : await waPost<any>("/session/disconnect", { clearAuth: false });
      setOut(r);
      await refresh();
    } catch (e: any) {
      const msg = String(e.message || e);
      setError(msg);
      setOut({ error: msg });
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  async function resolveHuman(id: string, decision: "resolved" | "ignored") {
    setLoading(true); setError(null);
    try {
      const r = await apiPost<any>(`/human-review/${id}/resolve?decision=${decision}`);
      setOut(r);
      await refresh();
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  const queue = useMemo(() => humanQueue || [], [humanQueue]);
  const selectedItem = queue[selected] || null;

  return (
    <div className="space-y-4 animate-in-fade">
      {loading && <LoadingState label="Executando ação no WhatsApp..." />}
      {error && <ErrorState message={error} onRetry={refresh} />}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <GlassCard className="text-xs">WA status: <b>{waStatus?.status || "--"}</b></GlassCard>
        <GlassCard className="text-xs">Known: <b>{classes?.known_client ?? 0}</b></GlassCard>
        <GlassCard className="text-xs">New lead: <b>{classes?.new_lead ?? 0}</b></GlassCard>
        <GlassCard className="text-xs">Unknown: <b>{classes?.unknown ?? 0}</b></GlassCard>
        <GlassCard className="text-xs">Human review: <b>{classes?.human_review_pending ?? 0}</b></GlassCard>

        <GlassCard className="text-xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] text-muted-foreground">Conexão WhatsApp</div>
              <div className="font-semibold">{waStatus?.status || "offline"}</div>
            </div>
            {waStatus?.status !== "connected" ? (
              <button onClick={openConnectModal} className="liquid-btn liquid-btn-primary text-xs">Conectar via QR</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => action("catchup")} className="liquid-btn-ghost p-1.5"><RefreshCw className="h-3.5 w-3.5"/></button>
                <button onClick={() => action("disconnect")} className="liquid-btn-ghost p-1.5"><Link2Off className="h-3.5 w-3.5"/></button>
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      <div className="flex gap-4 h-[calc(100vh-14rem)]">
        <GlassCard className="w-80 flex-shrink-0 !p-0 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border/30">
            <div className="flex items-center gap-2 bg-secondary/50 rounded-xl px-3 py-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input placeholder="Buscar pendência..." className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none flex-1" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {queue.length === 0 ? (
              <div className="p-3"><EmptyState title="Sem conversas pendentes de revisão." /></div>
            ) : queue.map((item, i) => (
              <button key={item.id} onClick={() => setSelected(i)} className={`w-full flex items-start gap-3 p-3 text-left transition-colors ${selected === i ? "bg-primary/8 border-l-2 border-primary" : "hover:bg-secondary/30 border-l-2 border-transparent"}`}>
                <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">HR</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground truncate">{item.source}</p>
                    <span className="text-[10px] text-muted-foreground">{(item.created_at || "").slice(11, 16)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{item.text || "(sem texto)"}</p>
                  <StatusPill status="human_review_pending" className="mt-1" />
                </div>
              </button>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="flex-1 !p-0 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border/30">
            <div>
              <p className="text-sm font-semibold text-foreground">{selectedItem ? selectedItem.source : "Sem item selecionado"}</p>
              <StatusPill status="human_review_pending" />
            </div>
            <div className="flex items-center gap-2">
              <button className="liquid-btn-ghost p-2 rounded-xl text-xs flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Agendar</button>
              <button className="liquid-btn-ghost p-2 rounded-xl text-xs flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Ligar</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {selectedItem ? (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm glass-subtle text-foreground">
                  <p>{selectedItem.text || "(sem texto)"}</p>
                  <span className="text-[10px] text-muted-foreground mt-1 block text-right">{(selectedItem.created_at || "").replace("T", " ").slice(0, 16)}</span>
                </div>
              </div>
            ) : (
              <EmptyState title="Selecione um item de revisão para analisar." />
            )}
          </div>

          <div className="p-3 border-t border-border/30">
            {selectedItem ? (
              <div className="flex items-center gap-2">
                <button onClick={() => resolveHuman(selectedItem.id, "resolved")} className="liquid-btn liquid-btn-primary text-xs">Marcar como resolvido</button>
                <button onClick={() => resolveHuman(selectedItem.id, "ignored")} className="liquid-btn-ghost text-xs">Ignorar</button>
                <input placeholder="Observação operacional..." className="flex-1 bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground rounded-xl px-4 py-2.5 outline-none" />
                <button className="liquid-btn liquid-btn-primary p-2.5 rounded-xl"><Send className="h-4 w-4" /></button>
              </div>
            ) : (
              <EmptyState title="Sem ação disponível enquanto não houver item selecionado." />
            )}
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        {out ? (
          <pre className="text-xs overflow-auto">{JSON.stringify(out, null, 2)}</pre>
        ) : (
          <EmptyState title="Nenhuma ação executada ainda na sessão WhatsApp." />
        )}
      </GlassCard>

      {showWaModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <GlassCard className="w-full max-w-md space-y-3">
            <h3 className="text-sm font-semibold">Conectar WhatsApp</h3>
            <p className="text-xs text-muted-foreground">Escaneie o QR no celular da clínica.</p>
            <div className="rounded-xl bg-white p-3 flex justify-center">
              <img src={`/wa/session/qr.png?nonce=${qrNonce}`} alt="QR WhatsApp" className="w-64 h-64 object-contain" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setQrNonce(Date.now())} className="liquid-btn text-xs">Atualizar QR</button>
              <button onClick={() => setShowWaModal(false)} className="liquid-btn liquid-btn-primary text-xs">Fechar</button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
