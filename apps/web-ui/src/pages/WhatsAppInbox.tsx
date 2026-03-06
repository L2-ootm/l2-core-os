import { GlassCard } from "@/components/ui/glass-card";
import { Send, Phone, Calendar, Search, RefreshCw, Link2Off, UserPlus, Tag, MessageCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { apiGet, waGet, waPost, apiPost, setAuthToken } from "@/lib/api";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/async-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type HRItem = {
  id: string;
  source: string;
  reference_id?: string;
  text?: string;
  status: string;
  created_at: string;
  lead_name?: string | null;
};

/** Parse a merged text block into individual chat messages with sender + timestamp */
function parseMessages(text: string | undefined, createdAt: string) {
  if (!text) return [];
  const lines = text.split("\n").filter(Boolean);
  const msgs: { text: string; isOutbound: boolean; ts: string }[] = [];
  for (const line of lines) {
    if (line.startsWith("[L2]: ")) {
      msgs.push({ text: line.replace("[L2]: ", ""), isOutbound: true, ts: createdAt });
    } else {
      msgs.push({ text: line, isOutbound: false, ts: createdAt });
    }
  }
  return msgs;
}

function formatSource(source: string, leadName?: string | null) {
  if (leadName) return leadName;
  if (!source) return "Sem item selecionado";
  if (source === "unknown_phone" || source === "whatsapp_unknown_phone") return "Número Desconhecido";
  if (source.startsWith("whatsapp_")) {
    const phone = source.replace("whatsapp_", "");
    if (phone === "unknown_phone") return "Número Desconhecido";
    if (/^\d+$/.test(phone)) {
      if (phone.length === 13) {
        return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
      }
      if (phone.length === 12) {
        return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 8)}-${phone.slice(8)}`;
      }
      return `+${phone}`;
    }
    return phone;
  }
  return source;
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function WhatsAppInbox() {
  const [selected, setSelected] = useState(0);
  const [waStatus, setWaStatus] = useState<any>(null);
  const [classes, setClasses] = useState<any>(null);
  const [humanQueue, setHumanQueue] = useState<HRItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWaModal, setShowWaModal] = useState(false);
  const [qrNonce, setQrNonce] = useState(Date.now());
  const [searchTerm, setSearchTerm] = useState("");

  // Message Sending State
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Identify Lead State
  const [isIdentifyModalOpen, setIsIdentifyModalOpen] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadNotes, setLeadNotes] = useState("");
  const [isIdentifying, setIsIdentifying] = useState(false);

  // Classification popover
  const [classifyOpen, setClassifyOpen] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  async function ensureTokenIfNeeded(errMessage: string) {
    if (!/401/.test(errMessage)) return false;
    try {
      const r = await apiPost<any>("/auth/dev-token?role=owner");
      if (r?.token) {
        setAuthToken(r.token);
        return true;
      }
    } catch { }
    return false;
  }

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setError(null);
    try {
      const [w, c, h] = await Promise.all([
        waGet<any>("/session/status"),
        apiGet<any>("/ops/leads/classifications"),
        apiGet<any>("/human-review/list?status=pending&limit=200"),
      ]);
      setWaStatus(w);
      setClasses(c.classifications);
      setHumanQueue(h.items || []);
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
        } catch { }
      }
      if (!silent) setError(msg);
    }
  }, []);

  // Initial load + 5s polling for real-time feel
  useEffect(() => {
    refresh();
    const interval = setInterval(() => refresh(true), 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected, humanQueue]);

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
      kind === "catchup"
        ? await waPost<any>("/session/catchup")
        : await waPost<any>("/session/disconnect", { clearAuth: false });
      await refresh();
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function resolveHuman(id: string, decision: "resolved" | "ignored") {
    setLoading(true); setError(null);
    try {
      await apiPost<any>(`/human-review/${id}/resolve?decision=${decision}`);
      toast.success(decision === "resolved" ? "Marcado como resolvido!" : "Ignorado.");
      await refresh();
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  // Filter groups on UI side as extra safety + search
  const queue = useMemo(() => {
    let items = (humanQueue || []).filter(
      (item) => !item.source.includes("@g.us") && !item.source.includes("@newsletter") && !item.source.includes("@broadcast")
    );
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      items = items.filter(
        (item) =>
          (item.lead_name || "").toLowerCase().includes(q) ||
          item.source.toLowerCase().includes(q) ||
          (item.text || "").toLowerCase().includes(q)
      );
    }
    return items;
  }, [humanQueue, searchTerm]);

  const selectedItem = queue[selected] || null;

  async function sendMessage() {
    if (!message.trim() || !selectedItem) return;
    const phone = selectedItem.source.replace("whatsapp_", "");

    setIsSending(true);
    try {
      await waPost<any>("/outbound/send", {
        idempotency_key: crypto.randomUUID(),
        phone,
        message: message.trim(),
      });

      // Persist in DB thread
      try {
        await apiPost<any>(`/human-review/${selectedItem.id}/append-outbound`, {
          text: message.trim(),
        });
      } catch { /* non-critical */ }

      toast.success("Mensagem enviada!");
      setMessage("");
      await refresh(true);
    } catch (e: any) {
      toast.error(`Falha ao enviar: ${e.message}`);
    } finally {
      setIsSending(false);
    }
  }

  async function identifyLead() {
    if (!leadName.trim() || !selectedItem) return;
    const phone = selectedItem.source.replace("whatsapp_", "");

    setIsIdentifying(true);
    try {
      await apiPost<any>("/ops/leads/identify", {
        phone,
        full_name: leadName.trim(),
        notes: leadNotes.trim(),
      });
      toast.success("Lead identificado com sucesso!");
      setIsIdentifyModalOpen(false);
      setLeadName("");
      setLeadNotes("");
      await refresh();
    } catch (e: any) {
      toast.error(`Falha ao identificar: ${e.message}`);
    } finally {
      setIsIdentifying(false);
    }
  }

  const messages = useMemo(() => {
    if (!selectedItem) return [];
    return parseMessages(selectedItem.text, selectedItem.created_at);
  }, [selectedItem]);

  return (
    <div className="flex flex-col h-[calc(100vh-110px)] animate-in-fade overflow-hidden">
      {loading && <LoadingState label="Executando ação no WhatsApp..." />}
      {error && <ErrorState message={error} onRetry={() => refresh()} />}

      {/* Status Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-4 shrink-0">
        <GlassCard className="text-xs">WA: <b className={waStatus?.status === "connected" ? "text-emerald-400" : "text-amber-400"}>{waStatus?.status || "--"}</b></GlassCard>
        <GlassCard className="text-xs">Clientes: <b>{classes?.known_client ?? 0}</b></GlassCard>
        <GlassCard className="text-xs">Novos: <b>{classes?.new_lead ?? 0}</b></GlassCard>
        <GlassCard className="text-xs">Desconhecidos: <b>{classes?.unknown ?? 0}</b></GlassCard>
        <GlassCard className="text-xs">Pendentes: <b className="text-amber-400">{classes?.human_review_pending ?? 0}</b></GlassCard>

        <GlassCard className="text-xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] text-muted-foreground">Conexão</div>
              <div className="font-semibold">{waStatus?.status || "offline"}</div>
            </div>
            {waStatus?.status !== "connected" ? (
              <button onClick={openConnectModal} className="liquid-btn liquid-btn-primary text-xs">QR</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => action("catchup")} className="liquid-btn-ghost p-1.5"><RefreshCw className="h-3.5 w-3.5" /></button>
                <button onClick={() => action("disconnect")} className="liquid-btn-ghost p-1.5"><Link2Off className="h-3.5 w-3.5" /></button>
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Main Chat Layout - Fixed Height */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Sidebar - Lead List */}
        <GlassCard className="w-80 flex-shrink-0 !p-0 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border/30 shrink-0">
            <div className="flex items-center gap-2 bg-secondary/50 rounded-xl px-3 py-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                placeholder="Buscar lead..."
                className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none flex-1"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {queue.length === 0 ? (
              <div className="p-3"><EmptyState title="Sem conversas pendentes." /></div>
            ) : queue.map((item, i) => {
              const displayName = formatSource(item.source, item.lead_name);
              const initials = item.lead_name ? getInitials(item.lead_name) : "?";
              const lastMsg = (item.text || "").split("\n").filter(Boolean).pop() || "(sem texto)";
              const previewText = lastMsg.startsWith("[L2]: ") ? `Você: ${lastMsg.replace("[L2]: ", "")}` : lastMsg;

              return (
                <button key={item.id} onClick={() => setSelected(i)} className={`w-full flex items-start gap-3 p-3 text-left transition-all ${selected === i ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-secondary/30 border-l-2 border-transparent"}`}>
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${item.lead_name ? "bg-emerald-500/20 text-emerald-400" : "bg-primary/15 text-primary"}`}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">{(item.created_at || "").slice(11, 16)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{previewText}</p>
                    {/* Interactive classification micro-badge */}
                    <div className="mt-1 relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setClassifyOpen(classifyOpen === item.id ? null : item.id); }}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${item.lead_name ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25" : "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"}`}
                      >
                        <Tag className="h-2.5 w-2.5" />
                        {item.lead_name ? "Cliente" : "Classificar"}
                      </button>
                      {classifyOpen === item.id && (
                        <div className="absolute left-0 top-6 z-50 bg-background/95 backdrop-blur-xl border border-border/40 rounded-xl shadow-xl p-1.5 min-w-[180px] animate-in fade-in zoom-in-95 duration-150">
                          <button onClick={(e) => { e.stopPropagation(); setClassifyOpen(null); setSelected(i); setIsIdentifyModalOpen(true); }} className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-primary/10 flex items-center gap-2 transition-colors">
                            <UserPlus className="h-3 w-3" /> Identificar Lead
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setClassifyOpen(null); setSelected(i); setLeadNotes("cliente"); setIsIdentifyModalOpen(true); }} className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-blue-500/10 flex items-center gap-2 transition-colors text-blue-400">
                            <Tag className="h-3 w-3" /> Definir como Cliente
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setClassifyOpen(null); resolveHuman(item.id, "resolved"); }} className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-emerald-500/10 flex items-center gap-2 transition-colors text-emerald-400">
                            <MessageCircle className="h-3 w-3" /> Marcar Resolvido
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setClassifyOpen(null); resolveHuman(item.id, "ignored"); }} className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-rose-500/10 flex items-center gap-2 transition-colors text-rose-400">
                            <Tag className="h-3 w-3" /> Ignorar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </GlassCard>

        {/* Chat Panel - Fixed Height with internal scroll */}
        <GlassCard className="flex-1 !p-0 flex flex-col overflow-hidden">
          {/* Chat Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/30 shrink-0">
            <div>
              <p className="text-sm font-semibold text-foreground">{formatSource(selectedItem?.source || "", selectedItem?.lead_name)}</p>
              {selectedItem?.lead_name && (
                <span className="text-[10px] text-muted-foreground">{selectedItem.source.replace("whatsapp_", "+")}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 gap-1.5"
                onClick={() => setIsIdentifyModalOpen(true)}
                disabled={!selectedItem}
              >
                <UserPlus className="h-3.5 w-3.5" /> Identificar
              </Button>
              <button className="liquid-btn-ghost p-2 rounded-xl text-xs flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Agendar</button>
              <button className="liquid-btn-ghost p-2 rounded-xl text-xs flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Ligar</button>
            </div>
          </div>

          {/* Chat Messages - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
            {selectedItem ? (
              <>
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.isOutbound ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${msg.isOutbound
                      ? "bg-primary/20 border border-primary/30 text-foreground"
                      : "glass-subtle text-foreground"
                      }`}>
                      <p>{msg.text}</p>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </>
            ) : (
              <EmptyState title="Selecione uma conversa para visualizar." />
            )}
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-border/30 shrink-0">
            {selectedItem ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => resolveHuman(selectedItem.id, "resolved")} className="liquid-btn liquid-btn-primary text-xs">Resolvido</button>
                  <button onClick={() => resolveHuman(selectedItem.id, "ignored")} className="liquid-btn-ghost text-xs">Ignorar</button>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Textarea
                      placeholder="Resposta para o WhatsApp..."
                      className="min-h-[60px] max-h-[120px] bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground rounded-xl px-4 py-2.5 outline-none resize-none border-none focus-visible:ring-1 focus-visible:ring-primary/30"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                    />
                  </div>
                  <Button
                    className="h-[60px] w-12 rounded-xl flex items-center justify-center p-0"
                    onClick={sendMessage}
                    disabled={isSending || !message.trim()}
                  >
                    <Send className={`h-5 w-5 ${isSending ? "animate-pulse" : ""}`} />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground text-center py-3">Selecione uma conversa para responder.</div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Identify Lead Modal */}
      <Dialog open={isIdentifyModalOpen} onOpenChange={setIsIdentifyModalOpen}>
        <DialogContent className="sm:max-w-md glass-card border-border/40">
          <DialogHeader>
            <DialogTitle>Identificar Lead</DialogTitle>
            <DialogDescription>
              Vincule um nome e observações a este número de WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Lead</Label>
              <Input
                id="name"
                placeholder="Ex: João Silva"
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Ex: Interessado em implantes, captado via WhatsApp."
                value={leadNotes}
                onChange={(e) => setLeadNotes(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsIdentifyModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={identifyLead}
              disabled={isIdentifying || !leadName.trim()}
            >
              {isIdentifying ? "Salvando..." : "Salvar Contato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
