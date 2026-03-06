import { GlassCard } from "@/components/ui/glass-card";
import { KPICard } from "@/components/ui/kpi-card";
import { StatusPill } from "@/components/ui/status-pill";
import { Download, ArrowUpRight, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";

type Tx = {
  id: string;
  full_name?: string;
  amount: string;
  type: "income" | "expense";
  status: string;
  updated_at: string;
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

  useEffect(() => {
    (async () => {
      try {
        const [t, s] = await Promise.all([
          apiGet<{ ok: boolean; items: Tx[] }>("/transactions/list?limit=200"),
          apiGet<any>("/finance/summary"),
        ]);
        setTxs(t.items || []);
        setSummary(s || null);
      } catch {
        setTxs([]);
      }
    })();
  }, []);

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

  return (
    <div className="space-y-6 animate-in-fade">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">Financeiro</h1>
        <button className="liquid-btn flex items-center gap-2 text-xs"><Download className="h-3.5 w-3.5" /> Exportar</button>
      </div>

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
              <th>Cliente</th>
              <th>Valor</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {txs.map((tx) => (
              <tr key={tx.id}>
                <td className="text-xs text-muted-foreground font-mono">{(tx.updated_at || "").slice(0, 10)}</td>
                <td className="text-sm text-foreground">{tx.full_name || "--"}</td>
                <td className={`text-sm font-medium ${tx.type === "income" ? "text-success" : "text-destructive"}`}>{tx.type === "expense" ? "-" : "+"}R$ {tx.amount}</td>
                <td><StatusPill status={tx.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
