import { GlassCard } from "@/components/ui/glass-card";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/async-state";
import { Plus, CalendarPlus, Edit3, Search, Trash2, DollarSign, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { PipelineBoard } from "@/components/Pipeline/PipelineBoard";
import { DropResult } from "@hello-pangea/dnd";

type Client = {
  id: string;
  full_name: string;
  contact_phone: string;
  type: string;
  classification: string;
  pipeline_stage?: string;
  pipeline_value?: number;
  updated_at?: string;
};

type PipelineStage = {
  id: string;
  name: string;
  order_index: number;
  color: string;
};

const stages = ["Novo", "Qualificado", "Agendado", "Em Atendimento", "Fechado", "Perdido"] as const;

type Stage = (typeof stages)[number];

function stageFor(item: Client): Stage {
  if (item.type === "archived") return "Perdido";
  if (item.classification === "deal_won") return "Fechado";
  if (item.classification === "in_treatment") return "Em Atendimento";
  if (item.classification === "scheduled" || item.classification === "known_client") return "Agendado";
  if (item.classification === "qualified") return "Qualificado";
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

const stageIdMap: Record<string, string> = {
  "Novo": "novo",
  "Qualificado": "qualificado",
  "Agendado": "agendado",
  "Em Atendimento": "consulta",
  "Fechado": "fechado",
  "Perdido": "perdido",
};

const idStageMap: Record<string, string> = {
  "novo": "Novo",
  "qualificado": "Qualificado",
  "agendado": "Agendado",
  "consulta": "Em Atendimento",
  "fechado": "Fechado",
  "perdido": "Perdido",
};

const stageColorMap: Record<string, string> = {
  "novo": "#3b82f6",
  "qualificado": "#8b5cf6",
  "agendado": "#f59e0b",
  "consulta": "#10b981",
  "fechado": "#22c55e",
  "perdido": "#ef4444",
};

export default function LeadsCRM() {
  const [tab, setTab] = useState<"pipeline" | "dados">("pipeline");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Client[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);

  const [showClientModal, setShowClientModal] = useState(false);
  const [showApptModal, setShowApptModal] = useState(false);
  const [showValueModal, setShowValueModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [valueTarget, setValueTarget] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [quickMoveTarget, setQuickMoveTarget] = useState<Client | null>(null);

  const [clientForm, setClientForm] = useState({ full_name: "", contact_phone: "", type: "lead" });
  const [apptForm, setApptForm] = useState({ entity_id: "", date_time: "", status: "scheduled" });
  const [valueForm, setValueForm] = useState({ value: "" });
  const [searchQuery, setSearchQuery] = useState("");

  async function load() {
    setLoading(true); setError(null);
    try {
      const [r, stagesRes] = await Promise.all([
        apiGet<{ ok: boolean; items: Client[] }>("/entities/list?limit=500"),
        apiGet<{ ok: boolean; items: PipelineStage[] }>("/pipeline/stages").catch(() => ({ ok: true, items: [] })),
      ]);
      setItems((r.items || []));
      setPipelineStages(stagesRes.items || []);
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

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const item = items.find(i => i.id === draggableId);
    if (!item) return;

    const newStage = destination.droppableId as Stage;
    const newStageId = stageIdMap[newStage];

    let newType = item.type;
    let newClassification = item.classification;

    if (newStage === "Perdido") { newType = "archived"; newClassification = "lost"; }
    else if (newStage === "Fechado") { newType = "active"; newClassification = "deal_won"; }
    else if (newStage === "Em Atendimento") { newType = "active"; newClassification = "in_treatment"; }
    else if (newStage === "Agendado") { newType = "active"; newClassification = "scheduled"; }
    else if (newStage === "Qualificado") { newType = "lead"; newClassification = "qualified"; }
    else if (newStage === "Novo") { newType = "lead"; newClassification = "new_lead"; }

    const updatedItems = items.map(i =>
      i.id === item.id
        ? { ...i, type: newType, classification: newClassification, pipeline_stage: newStageId }
        : i
    );
    setItems(updatedItems);

    try {
      await apiPost(`/entities/${item.id}/pipeline/move`, {
        stage_id: newStageId,
        value: item.pipeline_value || null,
      });
    } catch (e) {
      console.error("Failed to save drag drop", e);
      load();
    }
  };

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

  async function confirmDeleteClient() {
    if (!deleteTarget) return;
    setLoading(true); setError(null);
    try {
      await apiPost("/entities/delete", { id: deleteTarget.id });
      setDeleteTarget(null);
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

  async function saveValue() {
    if (!valueTarget || !valueForm.value) return;
    setLoading(true);
    try {
      await apiPost(`/entities/${valueTarget.id}/pipeline/move`, {
        stage_id: valueTarget.pipeline_stage || "novo",
        value: parseFloat(valueForm.value),
      });
      setShowValueModal(false);
      setValueTarget(null);
      setValueForm({ value: "" });
      load();
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function quickMove(client: Client, newStageId: string) {
    const updatedItems = items.map(i =>
      i.id === client.id ? { ...i, pipeline_stage: newStageId } : i
    );
    setItems(updatedItems);
    setQuickMoveTarget(null);

    try {
      await apiPost(`/entities/${client.id}/pipeline/move`, {
        stage_id: newStageId,
        value: client.pipeline_value || null,
      });
    } catch (e) {
      console.error("Failed to quick move", e);
      load();
    }
  }

  const formatCurrency = (val?: number) => {
    if (!val) return null;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="space-y-5 animate-in-fade">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-foreground">Clientes</h1>
          <p className="text-xs text-muted-foreground">Pipeline e base de dados operacional</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEditing(null); setShowClientModal(true); }} className="liquid-btn liquid-btn-primary text-xs flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Novo cliente</button>
          <button onClick={() => setShowApptModal(true)} className="liquid-btn text-xs flex items-center gap-1.5"><CalendarPlus className="h-3.5 w-3.5" /> Novo agendamento</button>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab("pipeline")} className={`liquid-btn text-xs ${tab === "pipeline" ? "liquid-btn-primary" : ""}`}>Pipeline</button>
        <button onClick={() => setTab("dados")} className={`liquid-btn text-xs ${tab === "dados" ? "liquid-btn-primary" : ""}`}>Dados</button>
      </div>

      {loading && <LoadingState label="Carregando clientes..." />}
      {error && <ErrorState message={error} onRetry={load} />}

      {tab === "pipeline" && (
        <PipelineBoard
          items={items}
          onDragEnd={onDragEnd}
          onCardClick={(c) => {
            setEditing(c);
            setClientForm({ full_name: c.full_name, contact_phone: c.contact_phone, type: c.type || "lead" });
            setShowClientModal(true);
          }}
        />
      )}

      {tab === "dados" && (
        <GlassCard className="!p-0 overflow-hidden">
          {/* Search bar */}
          <div className="p-3 border-b border-border/20 flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 bg-secondary/50 rounded-xl px-3 py-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                placeholder="Buscar por nome ou telefone..."
                className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <span className="text-xs text-muted-foreground">{items.filter(c => {
              if (!searchQuery.trim()) return true;
              const q = searchQuery.toLowerCase();
              return c.full_name?.toLowerCase().includes(q) || c.contact_phone?.includes(q);
            }).length} resultados</span>
          </div>
          {items.length === 0 ? (
            <div className="p-4"><EmptyState title="Nenhum cliente cadastrado." /></div>
          ) : (
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Nome</th><th>Telefone</th><th>Etapa</th><th>Valor</th><th>Classificação</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.filter(c => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return c.full_name?.toLowerCase().includes(q) || c.contact_phone?.includes(q);
                }).map((c) => (
                  <tr key={c.id}>
                    <td className="text-sm">{c.full_name}</td>
                    <td className="text-xs text-muted-foreground">{c.contact_phone}</td>
                    <td>
                      <div className="relative">
                        <button
                          onClick={() => setQuickMoveTarget(quickMoveTarget?.id === c.id ? null : c)}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border/30 hover:bg-secondary/50 transition-colors"
                          style={{ 
                            borderLeftColor: stageColorMap[c.pipeline_stage || 'novo'],
                            borderLeftWidth: '3px'
                          }}
                        >
                          <span>{idStageMap[c.pipeline_stage || 'novo'] || 'Novo'}</span>
                          <ChevronDown className="h-3 w-3" />
                        </button>
                        {quickMoveTarget?.id === c.id && (
                          <div className="absolute z-10 mt-1 py-1 bg-[#1a1a1a] border border-border/30 rounded-md shadow-lg min-w-[140px]">
                            {Object.entries(idStageMap).map(([stageId, stageName]) => (
                              <button
                                key={stageId}
                                onClick={() => quickMove(c, stageId)}
                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-secondary/50 transition-colors ${
                                  c.pipeline_stage === stageId ? 'bg-secondary/50 text-primary' : ''
                                }`}
                              >
                                {stageName}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <button
                        onClick={() => { setValueTarget(c); setValueForm({ value: String(c.pipeline_value || "") }); setShowValueModal(true); }}
                        className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                      >
                        <DollarSign className="h-3 w-3" />
                        {formatCurrency(c.pipeline_value) || 'Definir'}
                      </button>
                    </td>
                    <td><StatusPill status={c.classification || "unknown"} /></td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditing(c); setClientForm({ full_name: c.full_name, contact_phone: c.contact_phone, type: c.type || "lead" }); setShowClientModal(true); }}
                          className="liquid-btn-ghost text-xs flex items-center gap-1.5"
                        ><Edit3 className="h-3.5 w-3.5" /> Editar</button>
                        <button
                          onClick={() => setDeleteTarget({ id: c.id, name: c.full_name })}
                          className="liquid-btn-ghost text-xs flex items-center gap-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                        ><Trash2 className="h-3.5 w-3.5" /> Excluir</button>
                      </div>
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

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <GlassCard className="w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-rose-500/15 flex items-center justify-center flex-shrink-0">
                <Trash2 className="h-5 w-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Excluir Cliente</h3>
                <p className="text-xs text-muted-foreground">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <p className="text-sm text-foreground">
              Tem certeza que deseja excluir <b className="text-rose-400">{deleteTarget.name}</b> permanentemente?
            </p>
            <p className="text-[11px] text-muted-foreground">
              Todos os dados do lead, identidade de telefone e mensagens pendentes serão removidos.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-border/20">
              <button onClick={() => setDeleteTarget(null)} className="liquid-btn text-xs px-4 py-2">Cancelar</button>
              <button
                onClick={confirmDeleteClient}
                className="liquid-btn text-xs px-4 py-2 !bg-rose-500/20 !text-rose-400 hover:!bg-rose-500 hover:!text-white border border-rose-500/30 transition-colors"
                disabled={loading}
              >
                {loading ? "Excluindo..." : "Excluir Permanentemente"}
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Value Modal */}
      {showValueModal && valueTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-md space-y-3">
            <h3 className="text-sm font-semibold">Definir Valor do Lead</h3>
            <p className="text-xs text-muted-foreground">
              Valor potencial para {valueTarget.full_name}
            </p>
            <input
              type="number"
              step="0.01"
              className="w-full bg-secondary/50 rounded-xl px-3 py-2 text-sm"
              placeholder="0,00"
              value={valueForm.value}
              onChange={(e) => setValueForm({ ...valueForm, value: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowValueModal(false)} className="liquid-btn text-xs">Cancelar</button>
              <button onClick={saveValue} className="liquid-btn liquid-btn-primary text-xs">Salvar</button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
