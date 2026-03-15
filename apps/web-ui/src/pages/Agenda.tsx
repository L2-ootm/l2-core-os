import { GlassCard } from "@/components/ui/glass-card";
import { StatusPill } from "@/components/ui/status-pill";
import { Plus, Edit3, Repeat, Trash2, Calendar } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/async-state";
import { L2BigCalendar, CalendarEvent } from "@/components/Calendar/L2BigCalendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { L2DateTimePicker } from "@/components/ui/l2-datetime-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type RecurrenceRule = "none" | "daily" | "weekly" | "monthly";

type EventItem = {
  id: string;
  entity_id: string;
  full_name?: string;
  contact_phone?: string;
  status: string;
  scheduled_for?: string | null;
  meta_full_name?: string;
  meta_entity_id?: string;
  agenda_type?: string;
  duration_minutes?: number;
  notes?: string;
  recurrence_rule?: string | null;
  recurrence_end_date?: string | null;
  parent_event_id?: string | null;
  [key: string]: any;
};

type Client = { id: string; full_name: string; contact_phone: string };

function monthKey(iso?: string | null) {
  if (!iso) return "Sem data";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Sem data";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const DEFAULT_RESOURCES = [
  { id: '1', title: 'Consultório 1' },
  { id: '2', title: 'Consultório 2' }
];

export default function Agenda() {
  const [tab, setTab] = useState<"operacional" | "mensal">("mensal");
  const [items, setItems] = useState<EventItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic Resources State with migration from old defaults
  const [resources, setResources] = useState<{ id: string, title: string }[]>(() => {
    const saved = localStorage.getItem("l2_calendar_resources");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migrate away from old hardcoded names
        const hasOldDefaults = parsed.some((r: any) =>
          r.title?.includes("Dra. Ana") || r.title?.includes("Dr. Pedro")
        );
        if (hasOldDefaults) {
          localStorage.removeItem("l2_calendar_resources");
          return DEFAULT_RESOURCES;
        }
        return parsed;
      } catch { return DEFAULT_RESOURCES; }
    }
    return DEFAULT_RESOURCES;
  });
  const [isManagingResources, setIsManagingResources] = useState(false);
  const [newResourceName, setNewResourceName] = useState("");

  const handleAddResource = () => {
    if (!newResourceName.trim()) return;
    const nextId = String(Date.now());
    const updated = [...resources, { id: nextId, title: newResourceName }];
    setResources(updated);
    localStorage.setItem("l2_calendar_resources", JSON.stringify(updated));
    setNewResourceName("");
  };

  const handleRemoveResource = (id: string) => {
    if (resources.length <= 1) return; // Must have at least one
    const updated = resources.filter(r => r.id !== id);
    setResources(updated);
    localStorage.setItem("l2_calendar_resources", JSON.stringify(updated));
  };

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<boolean>(false);
  const [form, setForm] = useState({
    id: "",
    entity_id: "",
    agenda_type: "consulta",
    scheduled_for: "",
    duration_minutes: 60,
    status: "scheduled",
    notes: "",
    resourceId: "1",
    recurrence_rule: "none" as RecurrenceRule,
    recurrence_end_date: "",
  });

  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpClient, setFollowUpClient] = useState<{id: string, name: string} | null>(null);
  const [followUpDate, setFollowUpDate] = useState("");
  const [originalEventId, setOriginalEventId] = useState<string>("");

  async function load() {
    setLoading(true); setError(null);
    try {
      const [evResult, enResult] = await Promise.allSettled([
        apiGet<{ ok: boolean; items: EventItem[] }>("/events/list?limit=500"),
        apiGet<{ ok: boolean; items: Client[] }>("/entities/list?limit=500"),
      ]);
      if (evResult.status === "fulfilled") setItems(evResult.value.items || []);
      if (enResult.status === "fulfilled") setClients((enResult.value.items || []).map((x: any) => ({ id: x.id, full_name: x.full_name, contact_phone: x.contact_phone })));
      // Only show error if BOTH failed
      if (evResult.status === "rejected" && enResult.status === "rejected") {
        setError("Falha ao carregar dados da agenda.");
      }
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const calEvents = useMemo<CalendarEvent[]>(() => {
    return items.map((t) => {
      // Deterministic fallback assignment based on available dynamic resources
      const charCode = t.id.charCodeAt(0) || 0;
      const fallbackIndex = charCode % resources.length;

      const resourceId = t.raw?.resourceId || resources[fallbackIndex]?.id || "1";

      return {
        id: t.id,
        title: `${t.meta_full_name} (${t.agenda_type})`,
        start: new Date(t.scheduled_for || new Date()),
        end: new Date(new Date(t.scheduled_for || new Date()).getTime() + (t.duration_minutes || 60) * 60000),
        resourceId,
        raw: t,
      };
    });
  }, [items, resources]);

  async function saveEvent() {
    if (!form.entity_id) return;
    setLoading(true); setError(null);
    try {
      const eventId = form.id || crypto.randomUUID();
      
      await apiPost("/events/upsert", {
        id: eventId,
        entity_id: form.entity_id,
        status: form.status,
        scheduled_for: form.scheduled_for || null,
        recurrence_rule: form.recurrence_rule !== "none" ? form.recurrence_rule : null,
        recurrence_end_date: form.recurrence_rule !== "none" && form.recurrence_end_date ? form.recurrence_end_date : null,
      });

      if (form.recurrence_rule !== "none" && form.scheduled_for && form.recurrence_end_date) {
        const startDate = new Date(form.scheduled_for);
        const endDate = new Date(form.recurrence_end_date);
        const maxDate = new Date();
        maxDate.setMonth(maxDate.getMonth() + 3);
        
        const effectiveEnd = endDate > maxDate ? maxDate : endDate;
        const events: any[] = [];
        
        let currentDate = new Date(startDate);
        
        while (currentDate <= effectiveEnd) {
          if (form.recurrence_rule === "daily") {
            currentDate.setDate(currentDate.getDate() + 1);
          } else if (form.recurrence_rule === "weekly") {
            currentDate.setDate(currentDate.getDate() + 7);
          } else if (form.recurrence_rule === "monthly") {
            currentDate.setMonth(currentDate.getMonth() + 1);
          }
          
          if (currentDate <= effectiveEnd) {
            events.push({
              id: crypto.randomUUID(),
              entity_id: form.entity_id,
              status: form.status,
              scheduled_for: currentDate.toISOString().slice(0, 16),
              parent_event_id: eventId,
            });
          }
        }
        
        if (events.length > 0) {
          await apiPost("/events/bulk-create", { events });
        }
      }
      
      setShowModal(false);
      setEditing(false);
      setForm({ id: "", entity_id: "", agenda_type: "consulta", scheduled_for: "", duration_minutes: 60, status: "scheduled", notes: "", resourceId: "1", recurrence_rule: "none", recurrence_end_date: "" });
      await load();
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(event: CalendarEvent) {
    const raw = event.raw as EventItem;
    setForm({
      id: raw.id,
      entity_id: raw.meta_entity_id, // Use meta_entity_id
      agenda_type: raw.agenda_type,
      scheduled_for: raw.scheduled_for,
      duration_minutes: raw.duration_minutes,
      status: raw.status,
      notes: raw.notes || "",
      resourceId: event.resourceId || "1", // Ensure resourceId is set
      recurrence_rule: (raw.recurrence_rule as RecurrenceRule) || "none",
      recurrence_end_date: raw.recurrence_end_date || "",
    });
    setEditing(true);
    setShowModal(true);
  }

  function handleSelectSlot(slotInfo: { start: Date; end: Date; resourceId?: string }) {
    setForm({
      id: "",
      entity_id: "",
      agenda_type: "consulta",
      scheduled_for: new Date(slotInfo.start.getTime() - (slotInfo.start.getTimezoneOffset() * 60000)).toISOString().slice(0, 16),
      duration_minutes: 60,
      status: "scheduled",
      notes: "",
      resourceId: slotInfo.resourceId || "1", // Ensure resourceId is set
      recurrence_rule: "none",
      recurrence_end_date: "",
    });
    setEditing(false);
    setShowModal(true);
  }

  async function onEventDrop({ event, start, end, resourceId }: { event: CalendarEvent; start: string | Date; end: string | Date; resourceId?: string }) {
    setLoading(true);
    try {
      const startIso = new Date(new Date(start).getTime() - (new Date(start).getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
      await apiPost("/events/upsert", {
        id: event.id,
        entity_id: (event.raw as EventItem).entity_id || (event.raw as EventItem).meta_entity_id,
        status: (event.raw as EventItem).status,
        scheduled_for: startIso,
      });
      await load();
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }



  async function onEventResize({ event, start, end }: { event: CalendarEvent; start: string | Date; end: string | Date; }) {
    setLoading(true);
    try {
      const endInDate = new Date(end);
      const startInDate = new Date(start);
      const startIso = new Date(startInDate.getTime() - (startInDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
      const durationMinutes = Math.round((endInDate.getTime() - startInDate.getTime()) / 60000);

      await apiPost("/events/upsert", {
        id: event.id,
        entity_id: (event.raw as EventItem).entity_id || (event.raw as EventItem).meta_entity_id,
        status: (event.raw as EventItem).status,
        scheduled_for: startIso,
      });
      await load();
      await load();
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteEvent(event: CalendarEvent) {
    if (!window.confirm("Tem certeza que deseja apagar este agendamento?")) return;
    setLoading(true);
    try {
      await apiDelete(`/events/${event.id}`);
      await load();
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteWithFollowUp() {
    if (!form.id || !form.entity_id) return;
    
    setLoading(true);
    try {
      await apiPost("/events/upsert", { 
        id: form.id, 
        entity_id: form.entity_id,
        status: "completed", 
        scheduled_for: form.scheduled_for,
      });

      setFollowUpClient({ id: form.entity_id, name: clients.find(c => c.id === form.entity_id)?.full_name || "Cliente" });
      setOriginalEventId(form.id);
      setShowModal(false);
      setShowFollowUpModal(true);
      await load();
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function createFollowUp() {
    if (!followUpClient || !followUpDate || !originalEventId) return;
    
    setLoading(true);
    try {
      await apiPost("/events/upsert", {
        id: crypto.randomUUID(),
        entity_id: followUpClient.id,
        status: "scheduled",
        scheduled_for: followUpDate,
        notes: "Retorno - agendar após consulta",
        parent_event_id: originalEventId,
      });
      
      setShowFollowUpModal(false);
      setFollowUpClient(null);
      setFollowUpDate("");
      setOriginalEventId("");
      await load();
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-110px)] animate-in-fade overflow-hidden">
      {/* Universal Enterprise Header */}
      <div className="flex justify-between items-center bg-black/40 p-4 rounded-xl border border-white/5 mb-4 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/50">
            {tab === "mensal" ? "Grade Mestre" : "Lista Operacional"}
          </h2>
          <div className="h-6 w-px bg-white/10 mx-2" />
          <div className="flex gap-1 bg-black/20 p-1 rounded-lg border border-white/5">
            <button onClick={() => setTab("mensal")} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${tab === "mensal" ? "bg-primary/20 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground"}`}>Calendário</button>
            <button onClick={() => setTab("operacional")} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${tab === "operacional" ? "bg-primary/20 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground"}`}>Lista</button>
          </div>
        </div>
        <div className="flex gap-3">
          {tab === "mensal" && (
            <button
              onClick={() => setIsManagingResources(true)}
              className="liquid-btn-ghost px-4 py-2 border border-border/40 hover:bg-white/5 flex items-center gap-2"
            >
              <Edit3 className="w-4 h-4" /> Configurar Colunas
            </button>
          )}
          <button onClick={() => { setEditing(false); setForm({ id: "", entity_id: "", agenda_type: "consulta", scheduled_for: "", duration_minutes: 60, status: "scheduled", notes: "", resourceId: "1", recurrence_rule: "none", recurrence_end_date: "" }); setShowModal(true); }} className="liquid-btn cursor-pointer px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-[0_0_15px_rgba(var(--primary),0.3)] transition-all flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Agendar Novo
          </button>
        </div>
      </div>

      {loading && <LoadingState label="Carregando agenda..." />}
      {error && <ErrorState message={error} onRetry={load} />}

      {tab === "operacional" && (
        <GlassCard className="!p-0 flex-1 overflow-auto">
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
                    <td className="text-sm">{e.meta_full_name || "Sem nome"}</td>
                    <td className="text-xs text-muted-foreground">{e.scheduled_for || "--"}</td>
                    <td><StatusPill status={e.status} /></td>
                    <td>
                      <button onClick={() => { handleEdit({ id: e.id, title: e.meta_full_name || "Sem nome", start: new Date(e.scheduled_for), end: new Date(new Date(e.scheduled_for).getTime() + (e.duration_minutes || 60) * 60000), raw: e, resourceId: String((e.id.charCodeAt(0) % 3) + 1) }); }} className="liquid-btn-ghost text-xs flex items-center gap-1.5"><Edit3 className="h-3.5 w-3.5" /> Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </GlassCard>
      )}

      {/* View Content */}
      {tab === "mensal" ? (
        <div className="flex flex-col flex-1 gap-4 animate-in fade-in duration-500 overflow-hidden">
          <GlassCard className="!p-1 flex-1 overflow-hidden border-primary/20 bg-[#0A0A0A] shadow-2xl relative w-full h-full flex flex-col">
            {loading && <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"><div className="loader mr-2"></div> Sincronizando Grade...</div>}
            <L2BigCalendar
              events={calEvents}
              resources={resources}
              onSelectEvent={handleEdit}
              onDeleteEvent={onDeleteEvent}
              onSelectSlot={handleSelectSlot}
              onEventDrop={onEventDrop}
              onEventResize={onEventResize}
            />
          </GlassCard>
        </div>
      ) : null}

      {/* Improved Shadcn Dialog instead of the giant modal screen */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md bg-black/95 backdrop-blur-2xl border-primary/20 shadow-2xl p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              {editing ? "Editar agendamento" : "Novo agendamento"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editing ? "Modifique os dados abaixo para atualizar." : "Selecione o paciente e o horário desejado."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Paciente</label>
            <Select value={form.entity_id} onValueChange={(val) => setForm({ ...form, entity_id: val })}>
              <SelectTrigger className="w-full bg-secondary/50 border-none rounded-xl">
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent className="bg-black/95 backdrop-blur-xl border-primary/20">
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="hover:bg-primary/20 cursor-pointer">
                    {c.full_name} <span className="text-muted-foreground ml-2 text-xs">{c.contact_phone}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground mb-1 block">Data e Hora</label>
            <L2DateTimePicker value={form.scheduled_for || ""} onChange={(v) => setForm({ ...form, scheduled_for: v })} />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={form.status} onValueChange={(val) => setForm({ ...form, status: val })}>
              <SelectTrigger className="w-full bg-secondary/50 border-none rounded-xl">
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent className="bg-black/95 backdrop-blur-xl border-primary/20">
                <SelectItem value="scheduled">Agendado</SelectItem>
                <SelectItem value="confirmed">Confirmado</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="canceled">Cancelado</SelectItem>
                <SelectItem value="no_show">No-show</SelectItem>
                <SelectItem value="reschedule_requested">Remarcação</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Profissional / Coluna</label>
            <Select value={form.resourceId} onValueChange={(val) => setForm({ ...form, resourceId: val })}>
              <SelectTrigger className="w-full h-11 bg-black/40 border-white/10 text-sm">
                <SelectValue placeholder="Selecione onde alocar" />
              </SelectTrigger>
              <SelectContent className="bg-background/95 backdrop-blur-xl border-white/10">
                {resources.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="cursor-pointer focus:bg-primary/20">
                    {r.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!editing && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-2">
                  <Repeat className="w-3 h-3" /> Repetir
                </Label>
                <Select 
                  value={form.recurrence_rule} 
                  onValueChange={(val: RecurrenceRule) => setForm({ ...form, recurrence_rule: val })}
                >
                  <SelectTrigger className="w-full h-11 bg-black/40 border-white/10 text-sm">
                    <SelectValue placeholder="Sem repetição" />
                  </SelectTrigger>
                  <SelectContent className="bg-background/95 backdrop-blur-xl border-white/10">
                    <SelectItem value="none">Não repetir</SelectItem>
                    <SelectItem value="daily">Diariamente</SelectItem>
                    <SelectItem value="weekly">Semanalmente</SelectItem>
                    <SelectItem value="monthly">Mensalmente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.recurrence_rule !== "none" && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Repetir até</Label>
                  <input
                    type="date"
                    className="flex h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
                    value={form.recurrence_end_date}
                    onChange={(e) => setForm({ ...form, recurrence_end_date: e.target.value })}
                    min={form.scheduled_for ? form.scheduled_for.split("T")[0] : undefined}
                  />
                </div>
              )}
            </>
          )}

          {error && <div className="text-xs text-rose-500 font-semibold p-2 bg-rose-500/10 rounded-lg">{error}</div>}

          <div className="flex justify-between items-center gap-2 pt-2 border-t border-white/5 mt-4">
            {editing ? (
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const raw = form as any;
                    const isPartOfSeries = raw.parent_event_id || raw.recurrence_rule;
                    
                    if (isPartOfSeries) {
                      const choice = window.confirm("Este evento faz parte de uma série.\n\nClique em OK para excluir apenas este evento.\nClique em Cancelar para excluir toda a série.");
                      if (!choice) {
                        if (!window.confirm("Tem certeza que deseja excluir toda a série de eventos?")) return;
                        setLoading(true);
                        try {
                          await apiDelete(`/events/${form.id}?delete_series=true`);
                          setShowModal(false);
                          await load();
                        } catch (e: any) {
                          setError(String(e.message || e));
                        } finally {
                          setLoading(false);
                        }
                        return;
                      }
                    }
                    onDeleteEvent(form as unknown as CalendarEvent);
                  }}
                  className="liquid-btn text-xs px-4 py-2 !bg-rose-500/10 !text-rose-500 hover:!bg-rose-500 hover:!text-white border-rose-500/20 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Excluir
                </button>
                {form.status !== "completed" && form.status !== "canceled" && form.status !== "no_show" && (
                  <button
                    onClick={handleCompleteWithFollowUp}
                    disabled={loading}
                    className="liquid-btn text-xs px-4 py-2 !bg-emerald-500/10 !text-emerald-500 hover:!bg-emerald-500 hover:!text-white border-emerald-500/20 transition-colors flex items-center gap-1"
                  >
                    <Calendar className="w-3 h-3" />
                    Concluir e agendar retorno
                  </button>
                )}
              </div>
            ) : <div />}
            <div className="flex gap-2">
              <button onClick={() => setShowModal(false)} className="liquid-btn-ghost text-xs w-28">Cancelar</button>
              {form.recurrence_rule !== "none" && form.scheduled_for && form.recurrence_end_date ? (
                <button onClick={saveEvent} className="liquid-btn liquid-btn-primary text-xs w-auto px-4 flex justify-center gap-1">
                  <Repeat className="w-3 h-3" />
                  {loading ? "Salvando..." : "Criar série"}
                </button>
              ) : (
                <button onClick={saveEvent} className="liquid-btn liquid-btn-primary text-xs w-28 flex justify-center">{loading ? "Salvando..." : "Salvar"}</button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Resources Management Modal */}
      <Dialog open={isManagingResources} onOpenChange={setIsManagingResources}>
        <DialogContent className="sm:max-w-[500px] bg-black/95 backdrop-blur-2xl border-white/10 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Configurar Colunas da Agenda</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Define quem ou o quê será visualizado na Grade Diária.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="flex gap-2">
              <input
                className="flex-1 h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="Ex: Dra. Ana / Sala 2"
                value={newResourceName}
                onChange={e => setNewResourceName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddResource()}
              />
              <button onClick={handleAddResource} className="px-4 bg-primary text-black font-bold rounded-xl hover:bg-primary/90 transition-all">
                Adicionar
              </button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
              {resources.map(r => (
                <div key={r.id} className="flex justify-between items-center bg-white/5 border border-white/5 rounded-lg p-3 group">
                  <span className="text-sm font-medium text-foreground">{r.title}</span>
                  <button
                    onClick={() => handleRemoveResource(r.id)}
                    disabled={resources.length <= 1}
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  >
                    Remover
                  </button>
                </div>
              ))}
              {resources.length === 1 && (
                <p className="text-xs text-muted-foreground text-center pt-2">Você precisa ter pelo menos uma coluna na agenda.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Follow-up Modal */}
      <Dialog open={showFollowUpModal} onOpenChange={setShowFollowUpModal}>
        <DialogContent className="sm:max-w-md bg-black/95 backdrop-blur-2xl border-primary/20 shadow-2xl p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-500" />
              Agendar próximo atendimento
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {followUpClient ? `Agendar retorno para ${followUpClient.name}?` : "Selecione a data e hora do próximo atendimento."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground mb-1 block">Data e Hora do Retorno</label>
              <L2DateTimePicker value={followUpDate} onChange={setFollowUpDate} />
            </div>

            {error && <div className="text-xs text-rose-500 font-semibold p-2 bg-rose-500/10 rounded-lg">{error}</div>}

            <div className="flex justify-end gap-2 pt-2 border-t border-white/5 mt-4">
              <button 
                onClick={() => {
                  setShowFollowUpModal(false);
                  setFollowUpClient(null);
                  setFollowUpDate("");
                  setOriginalEventId("");
                }} 
                className="liquid-btn-ghost text-xs w-28"
              >
                Agora não
              </button>
              <button 
                onClick={createFollowUp} 
                disabled={!followUpDate || loading}
                className="liquid-btn liquid-btn-primary text-xs w-auto px-4 flex justify-center gap-1 disabled:opacity-50"
              >
                <Calendar className="w-3 h-3" />
                {loading ? "Agendando..." : "Agendar Retorno"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
