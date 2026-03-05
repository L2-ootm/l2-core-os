import { GlassCard } from "@/components/ui/glass-card";
import { KPICard } from "@/components/ui/kpi-card";
import { StatusPill } from "@/components/ui/status-pill";
import {
  Users, CheckCircle, XCircle, DollarSign, Clock, MessageCircle,
  AlertTriangle, TrendingUp
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { useEffect, useState } from "react";
import { apiGet, waGet } from "@/lib/api";

const revenueData = [
  { day: "Seg", value: 4200 }, { day: "Ter", value: 5800 },
  { day: "Qua", value: 3100 }, { day: "Qui", value: 6700 },
  { day: "Sex", value: 8200 }, { day: "Sáb", value: 4500 },
];

const confirmData = [
  { day: "Seg", confirmados: 12, cancelados: 2 },
  { day: "Ter", confirmados: 15, cancelados: 1 },
  { day: "Qua", confirmados: 10, cancelados: 3 },
  { day: "Qui", confirmados: 18, cancelados: 2 },
  { day: "Sex", confirmados: 20, cancelados: 1 },
  { day: "Sáb", confirmados: 8, cancelados: 0 },
];

const appointments = [
  { time: "09:00", patient: "Maria Silva", service: "Consulta Dermatológica", status: "confirmed" },
  { time: "09:30", patient: "João Oliveira", service: "Retorno Cardiologia", status: "scheduled" },
  { time: "10:00", patient: "Ana Costa", service: "Exame Laboratorial", status: "confirmed" },
  { time: "10:30", patient: "Carlos Santos", service: "Consulta Ortopedia", status: "reschedule_requested" },
  { time: "11:00", patient: "Fernanda Lima", service: "Check-up Anual", status: "confirmed" },
];

const pendingMessages = [
  { name: "Roberto Alves", msg: "Gostaria de remarcar minha consulta...", time: "2min" },
  { name: "Patrícia Souza", msg: "Qual o valor da consulta particular?", time: "8min" },
  { name: "Lucas Ferreira", msg: "Preciso de um atestado médico...", time: "15min" },
];

const alerts = [
  { type: "warning", msg: "Gateway WhatsApp instável — 2 reconexões nas últimas 4h" },
  { type: "error", msg: "3 transações financeiras pendentes de conciliação" },
];

const CustomTooltipStyle = {
  backgroundColor: "hsla(222, 44%, 9%, 0.95)",
  border: "1px solid hsla(222, 30%, 18%, 0.8)",
  borderRadius: "12px",
  padding: "8px 12px",
  fontSize: "12px",
  color: "hsl(210, 40%, 96%)",
  boxShadow: "0 8px 32px hsla(222, 47%, 4%, 0.5)",
};

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [classifications, setClassifications] = useState<any>(null);
  const [waStatus, setWaStatus] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, c, w] = await Promise.all([
          apiGet<any>("/ops/inbound/summary"),
          apiGet<any>("/ops/leads/classifications"),
          waGet<any>("/session/status"),
        ]);
        setSummary(s);
        setClassifications(c?.classifications || null);
        setWaStatus(w);
      } catch {
        // keep graceful fallback
      }
    })();
  }, []);

  const leads = classifications?.new_lead ?? 0;
  const unknown = classifications?.unknown ?? 0;
  const humanPending = classifications?.human_review_pending ?? 0;
  const inboundTotal = summary?.inbound_total ?? 0;

  return (
    <div className="space-y-6 animate-in-fade">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard label="Leads Novos" value={leads} change="classificação automática" changeType="positive" icon={Users} />
        <KPICard label="Inbound Total" value={inboundTotal} change="mensagens processadas" changeType="neutral" icon={CheckCircle} />
        <KPICard label="Desconhecidos" value={unknown} change="revisão necessária" changeType={unknown > 0 ? "negative" : "positive"} icon={XCircle} />
        <KPICard label="Receita do Dia" value="R$ 6.780" change="+12% vs ontem" changeType="positive" icon={DollarSign} />
        <KPICard label="Pendências" value={humanPending} change="human review" changeType={humanPending > 0 ? "negative" : "positive"} icon={Clock} />
        <KPICard label="WhatsApp" value={waStatus?.status || "offline"} change={`reconnects: ${waStatus?.reconnect_attempts ?? 0}`} changeType={waStatus?.status === "connected" ? "positive" : "negative"} icon={MessageCircle} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Receita Semanal</h3>
            <div className="flex items-center gap-1 text-xs text-success font-medium">
              <TrendingUp className="h-3 w-3" />
              +18%
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(215, 20%, 55%)" }} />
                <YAxis hide />
                <Tooltip contentStyle={CustomTooltipStyle} formatter={(v: number) => [`R$ ${v.toLocaleString("pt-BR")}`, "Receita"]} />
                <Area type="monotone" dataKey="value" stroke="hsl(217, 91%, 60%)" fill="url(#revenueGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Confirmações vs Cancelamentos</h3>
            <span className="text-xs text-muted-foreground">Últimos 7 dias</span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={confirmData} barGap={4}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(215, 20%, 55%)" }} />
                <YAxis hide />
                <Tooltip contentStyle={CustomTooltipStyle} />
                <Bar dataKey="confirmados" fill="hsl(160, 60%, 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cancelados" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Today appointments */}
        <GlassCard className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-foreground mb-4">Próximas Consultas — Hoje</h3>
          <div className="space-y-2">
            {appointments.map((apt, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-xl hover:bg-secondary/30 transition-colors">
                <span className="text-xs font-mono text-muted-foreground w-12">{apt.time}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{apt.patient}</p>
                  <p className="text-xs text-muted-foreground">{apt.service}</p>
                </div>
                <StatusPill status={apt.status} />
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Pending messages */}
          <GlassCard>
            <h3 className="text-sm font-semibold text-foreground mb-3">Mensagens Pendentes</h3>
            <div className="space-y-3">
              {pendingMessages.map((m, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-semibold text-primary flex-shrink-0 mt-0.5">
                    {m.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-foreground">{m.name}</p>
                      <span className="text-[10px] text-muted-foreground">{m.time}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{m.msg}</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Alerts */}
          <GlassCard>
            <h3 className="text-sm font-semibold text-foreground mb-3">Alertas Operacionais</h3>
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg text-xs ${
                  a.type === "error" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                }`}>
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>{a.msg}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
