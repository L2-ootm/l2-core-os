import { GlassCard } from "@/components/ui/glass-card";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/async-state";
import { Plus, CalendarPlus, Edit3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

type Client = {
  id: string;
  full_name: string;
  contact_phone: string;
  type: string;
  classification: string;
  updated_at?: string;
};

const stages = ["Novo", "Qualificado", "Agendado", "Em Atendimento", "Fechado", "Perdido"] as const;

type Stage = (typeof stages)[number];

function stageFor(item: Client): Stage {
  if (item.type === "archived") return "Perdido";
  if (item.classification === "known_client") return "Qualificado";
  if (item.type === "active") return "Agendado";
  return "Novo";
}

const stageColor: Record<Stage, string> = {
  "Novo": "border-l-sky-400",
  "Qualificado": "border-l-amber-400",
  "Agendado": "border-l-violet-400",
  "Em Atendimento": "border-l-blue-400",
  "Fechado": "border-l-emerald-400",
  "Perdido": "border-l-rose-400",
};

export default function LeadsCRM() {
  const [tab, setTab] = useState<"pipeline" | "dados">("pipeline");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Client[]>([]);

  const [showClientModal, setShowClientModal] = useState(false);
  const [showApptModal, setShowApptModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  const [clientForm, setClientForm] = useState({ full_name: "", contact_phone: "", type: "lead" });
  const [apptForm, setApptForm] = useState({ entity_id: "", date_time: "", status: "scheduled" });

  async function load() {
    setLoading(true); setError(null);
    try {
      const r = await apiGet<{ ok: boolean; items: Client[] }>("/entities/list?limit=500");
      setItems((r.items || []).filter((x) => x.type !== "archived"));
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const base: Record<Stage, Client[]> = {
      "Novo": [], "Qualificado": [], "Agendado": [], "Em Atendimento": [], "Fechado": [], "Perdido": [],
    };
    for (const it of items) base[stageFor(it)].push(it);
    return base;
  }, [items]);

  async function saveClient() {
    setLoading(true); setError(null);
    try {
      const id = editing?.id || crypto.randomUUID();
      await apiPost("/entities/upsert", {
        id,
        type: clientForm.type,
        full_name: clientForm.full_name,
        contact_phone: clientForm.contact_phone,
      });
      setShowClientModal(false);
      setEditing(null);
      setClientForm({ full_name: "", contact_phone: "", type: "lead" });
      await load();
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function saveAppointment() {
    if (!apptForm.entity_id) return;
    setLoading(true); setError(null);
    try {
      await apiPost("/events/upsert", {
        id: crypto.randomUUID(),
        entity_id: apptForm.entity_id,
        status: apptForm.status,
        scheduled_for: apptForm.date_time || null,
      });
      setShowApptModal(false);
      setApptForm({ entity_id: "", date_time: "", status: "scheduled" });
      await load();
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5 animate-in-fade">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-foreground">Clientes</h1>
          <p className="text-xs text-muted-foreground">Pipeline e base de dados operacional</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEditing(null); setShowClientModal(true); }} className="liquid-btn liquid-btn-primary text-xs flex items-center gap-1.5"><Plus className="h-3.5 w-3.5"/> Novo cliente</button>
          <button onClick={() => setShowApptModal(true)} className="liquid-btn text-xs flex items-center gap-1.5"><CalendarPlus className="h-3.5 w-3.5"/> Novo agendamento</button>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab("pipeline")} className={`liquid-btn text-xs ${tab === "pipeline" ? "liquid-btn-primary" : ""}`}>Pipeline</button>
        <button onClick={() => setTab("dados")} className={`liquid-btn text-xs ${tab === "dados" ? "liquid-btn-primary" : ""}`}>Dados</button>
      </div>

      {loading && <LoadingState label="Carregando clientes..." />}
      {error && <ErrorState message={error} onRetry={load} />}

      {tab === "pipeline" && (
        <GlassCard className="!p-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3">
            {stages.map((s) => (
              <div key={s} className="rounded-xl border border-border/30 p-2 min-h-[220px] bg-secondary/10">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{s}</p>
                  <span className="text-[10px] bg-secondary/50 rounded-full px-2 py-0.5">{grouped[s].length}</span>
                </div>
                <div className="space-y-2 max-h-[65vh] overflow-auto pr-1">
                  {grouped[s].map((c) => (
                    <div key={c.id} className={`rounded-xl border border-border/30 border-l-4 ${stageColor[s]} p-2 bg-background/40`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{c.full_name}</p>
                        <StatusPill status={c.classification || "unknown"} />
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{c.contact_phone}</p>
                    </div>
                  ))}
                  {grouped[s].length === 0 && <p className="text-[11px] text-muted-foreground">Sem clientes</p>}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {tab === "dados" && (
        <GlassCard className="!p-0 overflow-hidden">
          {items.length === 0 ? (
            <div className="p-4"><EmptyState title="Nenhum cliente cadastrado." /></div>
          ) : (
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Nome</th><th>Telefone</th><th>Tipo</th><th>Classificação</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id}>
                    <td className="text-sm">{c.full_name}</td>
                    <td className="text-xs text-muted-foreground">{c.contact_phone}</td>
                    <td className="text-xs">{c.type}</td>
                    <td><StatusPill status={c.classification || "unknown"} /></td>
                    <td>
                      <button
                        onClick={() => { setEditing(c); setClientForm({ full_name: c.full_name, contact_phone: c.contact_phone, type: c.type || "lead" }); setShowClientModal(true); }}
                        className="liquid-btn-ghost text-xs flex items-center gap-1.5"
                      ><Edit3 className="h-3.5 w-3.5"/> Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </GlassCard>
      )}

      {showClientModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-lg space-y-3">
            <h3 className="text-sm font-semibold">{editing ? "Editar cliente" : "Novo cliente"}</h3>
            <input className="w-full bg-secondary/50 rounded-xl px-3 py-2 text-sm" placeholder="Nome" value={clientForm.full_name} onChange={(e) => setClientForm({ ...clientForm, full_name: e.target.value })} />
            <input className="w-full bg-secondary/50 rounded-xl px-3 py-2 text-sm" placeholder="Telefone" value={clientForm.contact_phone} onChange={(e) => setClientForm({ ...clientForm, contact_phone: e.target.value })} />
            <select className="w-full bg-secondary/50 rounded-xl px-3 py-2 text-sm" value={clientForm.type} onChange={(e) => setClientForm({ ...clientForm, type: e.target.value })}>
              <option value="lead">Lead</option>
              <option value="active">Ativo</option>
              <option value="archived">Arquivado</option>
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowClientModal(false)} className="liquid-btn text-xs">Cancelar</button>
              <button onClick={saveClient} className="liquid-btn liquid-btn-primary text-xs">Salvar</button>
            </div>
          </GlassCard>
        </div>
      )}

      {showApptModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-lg space-y-3">
            <h3 className="text-sm font-semibold">Novo agendamento</h3>
            <select className="w-full bg-secondary/50 rounded-xl px-3 py-2 text-sm" value={apptForm.entity_id} onChange={(e) => setApptForm({ ...apptForm, entity_id: e.target.value })}>
              <option value="">Selecione um cliente</option>
              {items.map((c) => <option key={c.id} value={c.id}>{c.full_name} ({c.contact_phone})</option>)}
            </select>
            <input type="datetime-local" className="w-full bg-secondary/50 rounded-xl px-3 py-2 text-sm" value={apptForm.date_time} onChange={(e) => setApptForm({ ...apptForm, date_time: e.target.value })} />
            <select className="w-full bg-secondary/50 rounded-xl px-3 py-2 text-sm" value={apptForm.status} onChange={(e) => setApptForm({ ...apptForm, status: e.target.value })}>
              <option value="scheduled">Agendado</option>
              <option value="confirmed">Confirmado</option>
              <option value="canceled">Cancelado</option>
              <option value="reschedule_requested">Remarcação</option>
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowApptModal(false)} className="liquid-btn text-xs">Cancelar</button>
              <button onClick={saveAppointment} className="liquid-btn liquid-btn-primary text-xs">Salvar</button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
