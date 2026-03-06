import { GlassCard } from "@/components/ui/glass-card";
import { KPICard } from "@/components/ui/kpi-card";
import { StatusPill } from "@/components/ui/status-pill";
import { Download, ArrowUpRight, TrendingUp, TrendingDown, AlertTriangle, Plus, ChevronsUpDown, Check, Filter, Edit3, Clock, XCircle, Trash2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useEffect, useMemo, useState } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { apiGet, apiPost } from "@/lib/api";
import { LoadingState, ErrorState } from "@/components/ui/async-state";

type Tx = {
  id: string;
  full_name?: string;
  event_full_name?: string;
  meta_full_name?: string;
  amount: string;
  type: "income" | "expense";
  status: string;
  updated_at: string;
  category?: string;
  source_kind?: "patient" | "non_patient";
  source_origin?: "manual_dashboard" | "whatsapp_ai" | "automation";
  notes?: string;
};

const tooltipStyle = {
  backgroundColor: "hsla(222, 44%, 9%, 0.95)",
  border: "1px solid hsla(222, 30%, 18%, 0.8)",
  borderRadius: "12px",
  padding: "8px 12px",
  fontSize: "12px",
  color: "hsl(210, 40%, 96%)",
};

export function InteractiveStatusPill({ tx, onStatusChange }: { tx: Tx, onStatusChange: (txId: string, newStatus: string) => Promise<void> }) {
  const [hovering, setHovering] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAction = async (e: React.MouseEvent, status: string) => {
    e.stopPropagation();
    setLoading(true);
    await onStatusChange(tx.id, status);
    setLoading(false);
    setHovering(false);
  };

  if (loading) {
    return <div className="text-xs text-muted-foreground animate-pulse">wait...</div>;
  }

  if (hovering) {
    return (
      <div
        className="flex items-center gap-1.5 bg-secondary/80 backdrop-blur-sm rounded-full px-2 py-0.5 border border-white/10 shadow-lg scale-90 origin-left transition-all duration-200"
        onMouseLeave={() => setHovering(false)}
      >
        {tx.status !== "paid" && (
          <button onClick={(e) => handleAction(e, "paid")} className="p-1 rounded-full bg-success/20 hover:bg-success/40 text-success transition-colors" title="Marcar como Recebido/Pago">
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
        {tx.status !== "pending" && (
          <button onClick={(e) => handleAction(e, "pending")} className="p-1 rounded-full bg-warning/20 hover:bg-warning/40 text-warning transition-colors" title="Marcar como Pendente">
            <Clock className="w-3.5 h-3.5" />
          </button>
        )}
        {tx.status !== "failed" && (
          <button onClick={(e) => handleAction(e, "failed")} className="p-1 rounded-full bg-destructive/20 hover:bg-destructive/40 text-destructive transition-colors" title="Marcar como Falho/Inadimplente">
            <XCircle className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div onMouseEnter={() => setHovering(true)}>
      <StatusPill status={tx.status} className="scale-90 origin-left cursor-pointer hover:shadow-[0_0_10px_rgba(255,255,255,0.1)] transition-all" />
    </div>
  );
}

export default function Financeiro() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [summary, setSummary] = useState<any>({
    income_total: 0,
    expense_total: 0,
    net_total: 0,
    pending_total: 0
  });
  const [entities, setEntities] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ income: string[]; expense: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);

  const [form, setForm] = useState({
    id: "",
    entry_type: "income",
    amount: "",
    status: "pending",
    source_kind: "patient",
    entity_id: "",
    category: "consulta",
    notes: "",
  });

  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [t, s, e, c] = await Promise.all([
        apiGet<{ ok: boolean; items: Tx[] }>("/transactions/list?limit=200").catch(() => ({ ok: false, items: [] })),
        apiGet<any>("/finance/summary").catch(() => ({})),
        apiGet<{ ok: boolean; items: any[] }>("/entities/list?limit=300").catch(() => ({ ok: false, items: [] })),
        apiGet<any>("/finance/categories").catch(() => ({ income: [], expense: [] })),
      ]);
      setTxs(Array.isArray(t?.items) ? t.items.filter(Boolean) : []);
      setSummary(s || { income_total: 0, expense_total: 0, net_total: 0, pending_total: 0 });
      setEntities(Array.isArray(e?.items) ? e.items.filter(Boolean) : []);
      setCategories(c || { income: [], expense: [] });
    } catch (err: any) {
      console.error("Financeiro load error:", err);
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  const chart = useMemo(() => {
    const byDay: Record<string, { receita: number; despesa: number }> = {};
    const toNum = (v: any) => {
      if (typeof v === "number") return v;
      if (!v) return 0;
      const n = Number(String(v).replace("R$ ", "").replace(".", "").replace(",", "."));
      return isNaN(n) ? 0 : n;
    };
    txs.forEach(t => {
      if (!t) return;
      const d = (t.updated_at || "").slice(8, 10) || "--";
      if (!byDay[d]) byDay[d] = { receita: 0, despesa: 0 };
      if (t.type === "income") byDay[d].receita += toNum(t.amount);
      else byDay[d].despesa += toNum(t.amount);
    });
    return Object.entries(byDay).map(([day, v]) => ({ day, ...v }));
  }, [txs]);

  const filteredTxs = useMemo(() => {
    if (!Array.isArray(txs)) return [];
    return txs.filter(t => {
      if (!t) return false;
      if (filterType !== "all" && t.type !== filterType) return false;
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      return true;
    });
  }, [txs, filterType, filterCategory]);

  async function submitNewEntry() {
    setLoading(true); setError(null);
    try {
      const payload: any = {
        id: form.id || undefined,
        entry_type: form.entry_type,
        amount: form.amount.replace("R$ ", "").replace(".", "").replace(",", "."),
        status: form.status,
        source_kind: form.source_kind,
        entity_id: form.source_kind === "patient" ? (form.entity_id || null) : null,
        category: form.category,
        notes: form.notes || null,
      };
      await apiPost("/finance/entries/create", payload);
      setOpenForm(false);
      setForm({ ...form, id: "", amount: "", notes: "" });
      await loadAll();
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(tx: Tx) {
    if (!tx) return;
    setForm({
      id: tx.id,
      entry_type: tx.type,
      amount: tx.amount,
      status: tx.status,
      source_kind: tx.source_kind || "patient",
      entity_id: "",
      category: tx.category || "consulta",
      notes: tx.notes || ""
    });
    const entity = entities.find(e => e && (e.full_name === (tx.meta_full_name || tx.event_full_name)));
    if (entity) setForm(prev => ({ ...prev, entity_id: entity.id }));
    setOpenForm(true);
  }

  const handleStatusChange = async (txId: string, newStatus: string) => {
    try {
      await apiPost(`/finance/transactions/${txId}`, { status: newStatus });
      await loadAll();
    } catch (e: any) {
      setError(String(e.message || e));
    }
  };

  const handleDelete = async (txId: string) => {
    try {
      await apiPost("/finance/transactions/delete", { id: txId });
      await loadAll();
    } catch (e: any) {
      setError(String(e.message || e));
    }
    setDeletingTxId(null);
  };

  const categoryOptions = useMemo(() => {
    if (!categories) return [];
    const opts = form.entry_type === "income" ? categories.income : categories.expense;
    return Array.isArray(opts) ? opts : [];
  }, [categories, form.entry_type]);

  const allCategories = useMemo(() => {
    if (!categories) return [];
    const inc = Array.isArray(categories.income) ? categories.income : [];
    const exp = Array.isArray(categories.expense) ? categories.expense : [];
    return [...inc, ...exp];
  }, [categories]);

  const safeNetTotal = useMemo(() => {
    const val = summary?.net_total ?? 0;
    if (typeof val === "number") return val;
    const n = Number(String(val).replace(".", "").replace(",", "."));
    return isNaN(n) ? 0 : n;
  }, [summary]);

  return (
    <div className="space-y-6 animate-in-fade relative">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">Financeiro</h1>
        <div className="flex gap-2">
          <button className="liquid-btn flex items-center gap-2 text-xs"><Download className="h-3.5 w-3.5" /> Exportar</button>
          <button onClick={async () => { setLoading(true); setError(null); try { await apiPost('/finance/undo-last-ai'); await loadAll(); } catch (e: any) { setError(String(e.message || e)); } finally { setLoading(false); } }} className="liquid-btn text-xs border border-warning/50 text-warning">Desfazer último IA</button>
          <button onClick={() => { setForm({ id: "", entry_type: "income", amount: "", status: "pending", source_kind: "patient", entity_id: "", category: "consulta", notes: "" }); setOpenForm(true); }} className="liquid-btn liquid-btn-primary flex items-center gap-2 text-xs"><Plus className="h-3.5 w-3.5" /> Nova entrada</button>
          <button onClick={() => { setForm({ id: "", entry_type: "expense", amount: "", status: "pending", source_kind: "non_patient", entity_id: "", category: "aluguel", notes: "" }); setOpenForm(true); }} className="liquid-btn flex items-center gap-2 text-xs border border-destructive/50 text-destructive">Nova saída</button>
        </div>
      </div>

      {loading && <LoadingState label="Processando financeiro..." />}
      {error && <ErrorState message={error} onRetry={loadAll} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Receita Total" value={`R$ ${summary?.income_total ?? 0}`} change="receita bruta" changeType="positive" icon={ArrowUpRight} />
        <KPICard label="Despesas" value={`R$ ${summary?.expense_total ?? 0}`} change="saídas totais" changeType="neutral" icon={TrendingDown} />
        <KPICard label="Resultado" value={`R$ ${summary?.net_total ?? 0}`} change="lucro líquido" changeType={safeNetTotal >= 0 ? "positive" : "negative"} icon={TrendingUp} />
        <KPICard label="Pendências" value={`R$ ${summary?.pending_total ?? 0}`} change="a receber" changeType="negative" icon={AlertTriangle} />
      </div>

      <GlassCard>
        <h3 className="text-sm font-semibold text-foreground mb-4">Fluxo (por dia de atualização)</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="recGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="despGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(215, 20%, 55%)" }} />
              <YAxis hide />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="receita" stroke="hsl(160, 60%, 45%)" fill="url(#recGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="despesa" stroke="hsl(0, 72%, 51%)" fill="url(#despGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <GlassCard className="!p-0 overflow-hidden">
        <div className="p-4 border-b border-border/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-foreground">Transações</h3>
          <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
            <Filter className="w-4 h-4 text-muted-foreground ml-2" />
            <select className="bg-transparent text-xs text-foreground focus:outline-none cursor-pointer py-1" value={filterType} onChange={(e) => setFilterType(e.target.value as any)}>
              <option value="all" className="bg-black">Todos os Tipos</option>
              <option value="income" className="bg-black text-success">Entradas</option>
              <option value="expense" className="bg-black text-destructive">Saídas</option>
            </select>
            <div className="w-px h-4 bg-white/10" />
            <select className="bg-transparent text-xs text-foreground focus:outline-none cursor-pointer py-1 pr-2 max-w-[150px] truncate" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="all" className="bg-black">Todas Categorias</option>
              {allCategories.map(c => <option key={c} value={c} className="bg-black">{c}</option>)}
            </select>
          </div>
        </div>
        <table className="premium-table">
          <thead>
            <tr>
              <th>Atualizado</th>
              <th>Origem</th>
              <th>Canal</th>
              <th>Categoria</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredTxs.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-xs"><div className="flex justify-center"><AlertTriangle className="w-5 h-5 mb-2 opacity-50" /></div>Nenhuma transação encontrada</td></tr>
            ) : filteredTxs.map((tx) => (
              <tr key={tx.id} className="cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleEdit(tx)}>
                <td className="text-xs text-muted-foreground font-mono">{(tx.updated_at || "").slice(0, 10)}</td>
                <td className="text-sm text-foreground max-w-[180px] truncate">{tx.meta_full_name || tx.event_full_name || (tx.source_kind === "non_patient" ? "Não paciente" : "--")}</td>
                <td className="text-xs text-muted-foreground">{tx.source_origin || "manual_dashboard"}</td>
                <td className="text-xs text-muted-foreground">{tx.category || "outros"}</td>
                <td className={`text-sm font-medium ${tx.type === "income" ? "text-success" : "text-destructive"}`}>{tx.type === "expense" ? "-" : "+"}R$ {tx.amount}</td>
                <td><InteractiveStatusPill tx={tx} onStatusChange={handleStatusChange} /></td>
                <td>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); handleEdit(tx); }} className="p-1.5 rounded-lg bg-secondary/30 hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground" title="Editar">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDeletingTxId(tx.id); }} className="p-1.5 rounded-lg bg-transparent hover:bg-destructive/20 transition-colors text-muted-foreground/50 hover:text-destructive" title="Excluir">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      {openForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <GlassCard className="w-full max-w-2xl space-y-4">
            <h3 className="text-sm font-semibold">Nova entrada financeira</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Tipo</label>
                <input value={form.entry_type === "income" ? "Entrada" : "Saída"} readOnly className="w-full mt-1 bg-secondary/30 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Valor</label>
                <input className="w-full mt-1 bg-secondary/50 rounded-xl px-3 py-2 text-sm" placeholder="Ex: 450.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Origem</label>
                <select className="w-full mt-1 bg-secondary/50 rounded-xl px-3 py-2 text-sm" value={form.source_kind} onChange={(e) => setForm({ ...form, source_kind: e.target.value })}>
                  <option value="patient">Atendimento na clínica (paciente)</option>
                  <option value="non_patient">Não paciente</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Categoria</label>
                <select className="w-full mt-1 bg-secondary/50 rounded-xl px-3 py-2 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {categoryOptions.map((c: string) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {form.source_kind === "patient" && (
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Paciente associado</label>
                  <Popover open={patientSearchOpen} onOpenChange={setPatientSearchOpen}>
                    <PopoverTrigger asChild>
                      <button
                        role="combobox"
                        aria-expanded={patientSearchOpen}
                        className="w-full bg-secondary/50 rounded-xl px-3 py-2.5 text-sm flex items-center justify-between text-left hover:bg-secondary/70 transition-colors border border-border/30 hover:border-primary/50"
                      >
                        {form.entity_id
                          ? <span className="text-foreground">{entities.find((e) => e.id === form.entity_id)?.full_name}</span>
                          : <span className="text-muted-foreground font-medium">Selecione ou busque um paciente...</span>}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] max-w-[90vw] p-0 border-border/50 bg-black/95 backdrop-blur-xl z-[60]">
                      <Command className="bg-transparent text-foreground">
                        <CommandInput placeholder="Buscar por nome..." className="h-10 text-sm border-none focus:ring-0" />
                        <CommandList className="max-h-[250px] overflow-y-auto">
                          <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">Nenhum paciente encontrado.</CommandEmpty>
                          <CommandGroup>
                            {entities.map((e) => (
                              <CommandItem
                                key={e.id}
                                value={e.full_name}
                                onSelect={() => {
                                  setForm({ ...form, entity_id: e.id });
                                  setPatientSearchOpen(false);
                                }}
                                className="cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors aria-selected:bg-primary/20 aria-selected:text-primary"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 text-primary",
                                    form.entity_id === e.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {e.full_name} <span className="ml-auto text-xs text-muted-foreground font-mono">{e.contact_phone}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Observações</label>
                <textarea className="w-full mt-1 h-24 bg-secondary/50 rounded-xl px-3 py-2 text-sm" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setOpenForm(false)} className="liquid-btn text-xs">Cancelar</button>
              <button onClick={submitNewEntry} className="liquid-btn liquid-btn-primary text-xs">Salvar entrada</button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingTxId} onOpenChange={(o) => !o && setDeletingTxId(null)}>
        <AlertDialogContent className="bg-[#0A0A0A] border-border/20 text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita e os dados associados serão perdidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/10 hover:bg-white/5 hover:text-white">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTxId && handleDelete(deletingTxId)}
              className="bg-destructive/20 text-destructive border-transparent hover:bg-destructive hover:text-white"
            >
              Excluir Transação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
