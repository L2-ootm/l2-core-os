import { GlassCard } from "@/components/ui/glass-card";
import { StatusPill } from "@/components/ui/status-pill";
import { Plus, Edit3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/async-state";

type EventItem = {
  id: string;
  entity_id: string;
  full_name?: string;
  contact_phone?: string;
  status: string;
  scheduled_for?: string | null;
};

type Client = { id: string; full_name: string; contact_phone: string };

function monthKey(iso?: string | null) {
  if (!iso) return "Sem data";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Sem data";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Agenda() {
  const [tab, setTab] = useState<"operacional" | "mensal">("operacional");
  const [items, setItems] = useState<EventItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [form, setForm] = useState({ entity_id: "", scheduled_for: "", status: "scheduled" });

  async function load() {
    setLoading(true); setError(null);
    try {
      const [ev, en] = await Promise.all([
        apiGet<{ ok: boolean; items: EventItem[] }>("/events/list?limit=500"),
        apiGet<{ ok: boolean; items: Client[] }>("/entities/list?limit=500"),
      ]);
      setItems(ev.items || []);
      setClients((en.items || []).map((x: any) => ({ id: x.id, full_name: x.full_name, contact_phone: x.contact_phone })));
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const groupedDays = useMemo(() => {
    const g: Record<string, EventItem[]> = {};
    for (const e of items) {
      const k = monthKey(e.scheduled_for);
      if (!g[k]) g[k] = [];
      g[k].push(e);
    }
    return g;
  }, [items]);

  async function saveEvent() {
    if (!form.entity_id) return;
    setLoading(true); setError(null);
    try {
      await apiPost("/events/upsert", {
        id: editing?.id || crypto.randomUUID(),
        entity_id: form.entity_id,
        status: form.status,
        scheduled_for: form.scheduled_for || null,
      });
      setShowModal(false);
      setEditing(null);
      setForm({ entity_id: "", scheduled_for: "", status: "scheduled" });
      await load();
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5 animate-in-fade">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Agenda</h1>
          <p className="text-xs text-muted-foreground">Operacional e visão mensal</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ entity_id: "", scheduled_for: "", status: "scheduled" }); setShowModal(true); }} className="liquid-btn liquid-btn-primary text-xs flex items-center gap-1.5"><Plus className="h-3.5 w-3.5"/> Agendar</button>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab("operacional")} className={`liquid-btn text-xs ${tab === "operacional" ? "liquid-btn-primary" : ""}`}>Operacional</button>
        <button onClick={() => setTab("mensal")} className={`liquid-btn text-xs ${tab === "mensal" ? "liquid-btn-primary" : ""}`}>Todos os dias (mês)</button>
      </div>

      {loading && <LoadingState label="Carregando agenda..." />}
      {error && <ErrorState message={error} onRetry={load} />}

      {tab === "operacional" && (
        <GlassCard className="!p-0 overflow-hidden">
          {items.length === 0 ? (
            <div className="p-4"><EmptyState title="Sem agendamentos." /></div>
          ) : (
            <table className="premium-table">
              <thead>
                <tr><th>Paciente</th><th>Agendado para</th><th>Status</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e.id}>
                    <td className="text-sm">{e.full_name || "Sem nome"}</td>
                    <td className="text-xs text-muted-foreground">{e.scheduled_for || "--"}</td>
                    <td><StatusPill status={e.status} /></td>
                    <td>
                      <button onClick={() => { setEditing(e); setForm({ entity_id: e.entity_id, scheduled_for: e.scheduled_for || "", status: e.status }); setShowModal(true); }} className="liquid-btn-ghost text-xs flex items-center gap-1.5"><Edit3 className="h-3.5 w-3.5"/> Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </GlassCard>
      )}

      {tab === "mensal" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {Object.keys(groupedDays).length === 0 ? (
            <GlassCard><EmptyState title="Sem agendamentos no mês." /></GlassCard>
          ) : Object.entries(groupedDays).sort(([a],[b]) => a.localeCompare(b)).map(([day, list]) => (
            <GlassCard key={day}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">{day}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/50">{list.length}</span>
              </div>
              <div className="space-y-2 max-h-60 overflow-auto">
                {list.map((e) => (
                  <div key={e.id} className="rounded-xl border border-border/30 p-2">
                    <div className="text-sm truncate">{e.full_name || "Sem nome"}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{e.scheduled_for || "--"}</div>
                    <StatusPill status={e.status} className="mt-1" />
                  </div>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-lg space-y-3">
            <h3 className="text-sm font-semibold">{editing ? "Editar agendamento" : "Novo agendamento"}</h3>
            <select className="w-full bg-secondary/50 rounded-xl px-3 py-2 text-sm" value={form.entity_id} onChange={(e) => setForm({ ...form, entity_id: e.target.value })}>
              <option value="">Selecione um cliente</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name} ({c.contact_phone})</option>)}
            </select>
            <input type="datetime-local" className="w-full bg-secondary/50 rounded-xl px-3 py-2 text-sm" value={form.scheduled_for || ""} onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })} />
            <select className="w-full bg-secondary/50 rounded-xl px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="scheduled">Agendado</option>
              <option value="confirmed">Confirmado</option>
              <option value="completed">Concluído</option>
              <option value="canceled">Cancelado</option>
              <option value="no_show">No-show</option>
              <option value="reschedule_requested">Remarcação</option>
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="liquid-btn text-xs">Cancelar</button>
              <button onClick={saveEvent} className="liquid-btn liquid-btn-primary text-xs">Salvar</button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
