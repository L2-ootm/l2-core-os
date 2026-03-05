import { GlassCard } from "@/components/ui/glass-card";
import { KPICard } from "@/components/ui/kpi-card";
import { StatusPill } from "@/components/ui/status-pill";
import { Download, ArrowUpRight, TrendingUp, TrendingDown, AlertTriangle, Plus } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useEffect, useMemo, useState } from "react";
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

export default function Financeiro() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [entities, setEntities] = useState<any[]>([]);
  const [categories, setCategories] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState(false);

  const [form, setForm] = useState({
    entry_type: "income",
    amount: "",
    status: "pending",
    source_kind: "patient",
    entity_id: "",
    category: "consulta",
    notes: "",
  });

  async function loadAll() {
    setError(null);
    try {
      const [t, s, e, c] = await Promise.all([
        apiGet<{ ok: boolean; items: Tx[] }>("/transactions/list?limit=200"),
        apiGet<any>("/finance/summary"),
        apiGet<{ ok: boolean; items: any[] }>("/entities/list?limit=300"),
        apiGet<any>("/finance/categories"),
      ]);
      setTxs(t.items || []);
      setSummary(s || null);
      setEntities(e.items || []);
      setCategories(c || null);
    } catch (e: any) {
      setError(String(e.message || e));
    }
  }

  useEffect(() => { loadAll(); }, []);

  const chart = useMemo(() => {
    const byDay: Record<string, { receita: number; despesa: number }> = {};
    const toNum = (v: string) => Number(String(v).replace(",", ".")) || 0;
    txs.forEach(t => {
      const d = (t.updated_at || "").slice(8, 10) || "--";
      if (!byDay[d]) byDay[d] = { receita: 0, despesa: 0 };
      if (t.type === "income") byDay[d].receita += toNum(t.amount);
      else byDay[d].despesa += toNum(t.amount);
    });
    return Object.entries(byDay).map(([day, v]) => ({ day, ...v }));
  }, [txs]);

  async function submitNewEntry() {
    setLoading(true); setError(null);
    try {
      const payload: any = {
        entry_type: form.entry_type,
        amount: form.amount,
        status: form.status,
        source_kind: form.source_kind,
        entity_id: form.source_kind === "patient" ? (form.entity_id || null) : null,
        category: form.category,
        notes: form.notes || null,
      };
      await apiPost("/finance/entries/create", payload);
      setOpenForm(false);
      setForm({ ...form, amount: "", notes: "" });
      await loadAll();
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  const categoryOptions = form.entry_type === "income" ? (categories?.income || []) : (categories?.expense || []);

  return (
    <div className="space-y-6 animate-in-fade relative">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">Financeiro</h1>
        <div className="flex gap-2">
          <button className="liquid-btn flex items-center gap-2 text-xs"><Download className="h-3.5 w-3.5" /> Exportar</button>
          <button onClick={async () => { setLoading(true); setError(null); try { await apiPost('/finance/undo-last-ai'); await loadAll(); } catch(e:any){ setError(String(e.message||e)); } finally { setLoading(false);} }} className="liquid-btn text-xs border border-warning/50 text-warning">Desfazer último IA</button>
          <button onClick={() => { setForm({ ...form, entry_type: "income", category: "consulta" }); setOpenForm(true); }} className="liquid-btn liquid-btn-primary flex items-center gap-2 text-xs"><Plus className="h-3.5 w-3.5" /> Nova entrada</button>
          <button onClick={() => { setForm({ ...form, entry_type: "expense", category: "aluguel" }); setOpenForm(true); }} className="liquid-btn flex items-center gap-2 text-xs border border-destructive/50 text-destructive">Nova saída</button>
        </div>
      </div>

      {loading && <LoadingState label="Processando financeiro..." />}
      {error && <ErrorState message={error} onRetry={loadAll} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Receita Total" value={`R$ ${summary?.income_total ?? 0}`} change="income" changeType="positive" icon={ArrowUpRight} />
        <KPICard label="Despesas" value={`R$ ${summary?.expense_total ?? 0}`} change="expense" changeType="neutral" icon={TrendingDown} />
        <KPICard label="Resultado" value={`R$ ${summary?.net_total ?? 0}`} change="net" changeType={(summary?.net_total ?? 0) >= 0 ? "positive" : "negative"} icon={TrendingUp} />
        <KPICard label="Pendências" value={`R$ ${summary?.pending_total ?? 0}`} change="pending" changeType="negative" icon={AlertTriangle} />
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
        <div className="p-4 border-b border-border/30">
          <h3 className="text-sm font-semibold text-foreground">Transações</h3>
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
            </tr>
          </thead>
          <tbody>
            {txs.map((tx) => (
              <tr key={tx.id}>
                <td className="text-xs text-muted-foreground font-mono">{(tx.updated_at || "").slice(0, 10)}</td>
                <td className="text-sm text-foreground">{tx.meta_full_name || tx.event_full_name || (tx.source_kind === "non_patient" ? "Não paciente" : "--")}</td>
                <td className="text-xs text-muted-foreground">{tx.source_origin || "manual_dashboard"}</td>
                <td className="text-xs text-muted-foreground">{tx.category || "outros"}</td>
                <td className={`text-sm font-medium ${tx.type === "income" ? "text-success" : "text-destructive"}`}>{tx.type === "expense" ? "-" : "+"}R$ {tx.amount}</td>
                <td><StatusPill status={tx.status} /></td>
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
                  <label className="text-xs text-muted-foreground">Paciente</label>
                  <select className="w-full mt-1 bg-secondary/50 rounded-xl px-3 py-2 text-sm" value={form.entity_id} onChange={(e) => setForm({ ...form, entity_id: e.target.value })}>
                    <option value="">Selecione um paciente</option>
                    {entities.map((e) => <option key={e.id} value={e.id}>{e.full_name} ({e.contact_phone})</option>)}
                  </select>
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
    </div>
  );
}
