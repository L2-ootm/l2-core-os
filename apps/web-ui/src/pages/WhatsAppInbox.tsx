import { GlassCard } from "@/components/ui/glass-card";
import { StatusPill } from "@/components/ui/status-pill";
import { Send, Phone, Calendar, Search, Wifi, RefreshCw, Link2Off, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { apiGet, waGet, waPost } from "@/lib/api";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/async-state";

const conversations = [
  { id: 1, name: "Maria Silva", lastMsg: "Obrigada, confirmo presença!", time: "2min", unread: 0, type: "known_client" },
  { id: 2, name: "Número Desconhecido", lastMsg: "Boa tarde, vocês atendem por convênio?", time: "5min", unread: 2, type: "unknown" },
  { id: 3, name: "João Oliveira", lastMsg: "Preciso remarcar para sexta", time: "12min", unread: 1, type: "known_client" },
  { id: 4, name: "Ana Costa", lastMsg: "Qual valor da consulta particular?", time: "25min", unread: 1, type: "new_lead" },
];

const messages = [
  { from: "them", text: "Boa tarde! Recebi a mensagem sobre minha consulta amanhã.", time: "14:02" },
  { from: "bot", text: "Olá Maria! Confirmamos sua consulta amanhã às 09:00. Deseja confirmar, remarcar ou cancelar?", time: "14:02" },
  { from: "them", text: "Obrigada, confirmo presença!", time: "14:03" },
];

export default function WhatsAppInbox() {
  const [selected, setSelected] = useState(0);
  const [waStatus, setWaStatus] = useState<any>(null);
  const [classes, setClasses] = useState<any>(null);
  const [humanQueue, setHumanQueue] = useState<any[]>([]);
  const [out, setOut] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    try {
      const [w, c, h] = await Promise.all([
        waGet<any>("/session/status"),
        apiGet<any>("/ops/leads/classifications"),
        apiGet<any>("/human-review/list?status=pending&limit=30"),
      ]);
      setWaStatus(w);
      setClasses(c.classifications);
      setHumanQueue(h.items || []);
    } catch (e: any) {
      const msg = String(e.message || e);
      setError(msg);
      setOut({ error: msg });
    }
  }

  useEffect(() => { refresh(); }, []);

  async function action(kind: "connect" | "catchup" | "disconnect") {
    setLoading(true); setError(null);
    // optimistic visual hint (non-critical)
    if (kind === "connect") setWaStatus((prev: any) => ({ ...(prev || {}), status: "connecting" }));
    try {
      const r = kind === "connect"
        ? await waPost<any>("/session/connect")
        : kind === "catchup"
          ? await waPost<any>("/session/catchup")
          : await waPost<any>("/session/disconnect", { clearAuth: false });
      setOut(r);
      await refresh();
    } catch (e: any) {
      const msg = String(e.message || e);
      setError(msg);
      setOut({ error: msg });
      await refresh(); // rollback real status
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
        <GlassCard className="text-xs flex gap-2 items-center justify-end">
          <button onClick={() => action("connect")} className="liquid-btn-ghost p-1.5"><Wifi className="h-3.5 w-3.5"/></button>
          <button onClick={() => action("catchup")} className="liquid-btn-ghost p-1.5"><RefreshCw className="h-3.5 w-3.5"/></button>
          <button onClick={() => action("disconnect")} className="liquid-btn-ghost p-1.5"><Link2Off className="h-3.5 w-3.5"/></button>
          <button onClick={() => waGet<any>("/session/qr").then(setOut)} className="liquid-btn-ghost p-1.5"><QrCode className="h-3.5 w-3.5"/></button>
        </GlassCard>
      </div>

      <div className="flex gap-4 h-[calc(100vh-14rem)]">
        <GlassCard className="w-80 flex-shrink-0 !p-0 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border/30">
            <div className="flex items-center gap-2 bg-secondary/50 rounded-xl px-3 py-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input placeholder="Buscar conversa..." className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none flex-1" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.map((conv, i) => (
              <button key={conv.id} onClick={() => setSelected(i)} className={`w-full flex items-start gap-3 p-3 text-left transition-colors ${selected === i ? "bg-primary/8 border-l-2 border-primary" : "hover:bg-secondary/30 border-l-2 border-transparent"}`}>
                <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">{conv.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground truncate">{conv.name}</p>
                    <span className="text-[10px] text-muted-foreground">{conv.time}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{conv.lastMsg}</p>
                  <StatusPill status={conv.type} className="mt-1" />
                </div>
              </button>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="flex-1 !p-0 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border/30">
            <div>
              <p className="text-sm font-semibold text-foreground">{conversations[selected].name}</p>
              <StatusPill status={conversations[selected].type} />
            </div>
            <div className="flex items-center gap-2">
              <button className="liquid-btn-ghost p-2 rounded-xl text-xs flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Agendar</button>
              <button className="liquid-btn-ghost p-2 rounded-xl text-xs flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Ligar</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.from === "them" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${msg.from === "them" ? "glass-subtle text-foreground" : "bg-primary/15 text-foreground border border-primary/20"}`}>
                  <p>{msg.text}</p>
                  <span className="text-[10px] text-muted-foreground mt-1 block text-right">{msg.time}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-border/30">
            <div className="flex items-center gap-2">
              <input placeholder="Digite uma mensagem..." className="flex-1 bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground rounded-xl px-4 py-2.5 outline-none" />
              <button className="liquid-btn liquid-btn-primary p-2.5 rounded-xl"><Send className="h-4 w-4" /></button>
            </div>
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <div className="mb-3 text-sm font-semibold">Human Review Queue</div>
        {humanQueue.length === 0 ? (
          <EmptyState title="Sem pendências de revisão humana." />
        ) : (
          <div className="space-y-2 max-h-56 overflow-auto">
            {humanQueue.map((h) => (
              <div key={h.id} className="rounded-xl border border-border/40 p-2">
                <div className="text-xs text-muted-foreground">{h.source}</div>
                <div className="text-sm">{h.text || "(sem texto)"}</div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => resolveHuman(h.id, "resolved")} className="liquid-btn text-xs">Resolver</button>
                  <button onClick={() => resolveHuman(h.id, "ignored")} className="liquid-btn-ghost text-xs">Ignorar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard>
        {out ? (
          <pre className="text-xs overflow-auto">{JSON.stringify(out, null, 2)}</pre>
        ) : (
          <EmptyState title="Nenhuma ação executada ainda na sessão WhatsApp." />
        )}
      </GlassCard>
    </div>
  );
}
