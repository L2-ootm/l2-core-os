import { GlassCard } from "@/components/ui/glass-card";
import { LoadingState } from "@/components/ui/async-state";
import { KPICard } from "@/components/ui/kpi-card";
import { StatusPill } from "@/components/ui/status-pill";
import {
  Users, CheckCircle, XCircle, DollarSign, Clock, MessageCircle,
  AlertTriangle, TrendingUp, X, Calendar, Activity, Zap, Plus,
  FileText, Send, Shield, Cpu, Database, Wifi, RefreshCw
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { useEffect, useState } from "react";
import { apiGet, waGet, waPost, apiPost, setAuthToken } from "@/lib/api";
import { DashboardAgenda } from "@/components/Calendar/DashboardAgenda";
import { useAIIntent } from "@/hooks/useAIIntent";



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
  const [financeSummary, setFinanceSummary] = useState<any>(null);
  const [classifications, setClassifications] = useState<any>(null);
  const [waStatus, setWaStatus] = useState<any>(null);
  const [hardware, setHardware] = useState<any>(null);
  const [showWaModal, setShowWaModal] = useState(false);
  const [qrNonce, setQrNonce] = useState(Date.now());
  const [busyWa, setBusyWa] = useState(false);

  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [confirmData, setConfirmData] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [todayEvents, setTodayEvents] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [systemHealth, setSystemHealth] = useState<any>(null);

  const { notifications: aiNotifications, dismissNotification, executeAction, activeMotor } = useAIIntent();

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

  useEffect(() => {
    async function loadDashboard() {
      const [sResult, cResult, wResult, fResult, hResult, eResult, aResult, healthResult] = await Promise.allSettled([
        apiGet<any>("/ops/inbound/summary"),
        apiGet<any>("/ops/leads/classifications"),
        waGet<any>("/session/status"),
        apiGet<any>("/transactions/list"),
        apiGet<any>("/system/hardware"),
        apiGet<any>("/events/list?limit=500"),
        apiGet<any>("/audit/logs?limit=10"),
        apiGet<any>("/ops/gonogo/checklist"),
      ]);

      if (sResult.status === "fulfilled") setSummary(sResult.value);
      if (cResult.status === "fulfilled") setClassifications(cResult.value?.classifications || null);
      if (wResult.status === "fulfilled") setWaStatus(wResult.value);
      else setWaStatus({ status: "offline", reconnect_attempts: 0 });
      if (hResult.status === "fulfilled") setHardware(hResult.value);

      if (aResult.status === "fulfilled") {
        setAuditLogs(aResult.value?.items || []);
      }

      if (healthResult.status === "fulfilled") {
        setSystemHealth(healthResult.value);
      }

      const newAlerts: any[] = [];
      if (wResult.status === "rejected" || wResult.value?.status !== "connected") {
        newAlerts.push({ type: "error", msg: `Sistema WhatsApp desconectado ou instável.` });
      }

      if (fResult.status === "fulfilled") {
        // Compute summary client-side from the transaction list
        const txs = fResult.value?.transactions || [];
        const income = txs.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + parseFloat(t.amount || '0'), 0);
        const expense = txs.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + parseFloat(t.amount || '0'), 0);
        const pending = txs.filter((t: any) => t.status === 'pending');
        setFinanceSummary({ net_total: income - expense, pending_total: pending.reduce((s: number, t: any) => s + parseFloat(t.amount || '0'), 0), pending_count: pending.length });

        if (pending.length > 0) {
          newAlerts.push({ type: "warning", msg: `${pending.length} transações financeiras pendentes de conciliação.` });
        }

        // Generate Revenue Chart
        const days = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          const dayStr = d.toISOString().split('T')[0];
          const label = d.toLocaleDateString("pt-BR", { weekday: 'short' }).replace('.', '').replace('-feira', '');
          days.push({ date: dayStr, label: label.charAt(0).toUpperCase() + label.slice(1) });
        }
        const newRev = days.map(d => {
          const val = txs.filter((t: any) => t.type === 'income' && (t.updated_at || "").startsWith(d.date)).reduce((acc: number, t: any) => acc + parseFloat(t.amount || '0'), 0);
          return { day: d.label, value: val };
        });
        setRevenueData(newRev);
      } else {
        setFinanceSummary({ net_total: 0, pending_total: 0, pending_count: 0 });
      }

      if (eResult.status === "fulfilled") {
        const events = eResult.value?.items || [];
        
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        
        const todayEventsList = events.filter((e: any) => 
          (e.scheduled_for || "").startsWith(todayStr) && e.status !== 'cancelled'
        ).sort((a: any, b: any) => (a.scheduled_for || '').localeCompare(b.scheduled_for || ''));
        setTodayEvents(todayEventsList);

        const next3Days: string[] = [];
        for (let i = 0; i < 3; i++) {
          const d = new Date(); d.setDate(d.getDate() + i);
          next3Days.push(d.toISOString().split('T')[0]);
        }
        
        const upcoming = events.filter((e: any) => 
          next3Days.some(d => (e.scheduled_for || "").startsWith(d)) && e.status !== 'cancelled'
        ).sort((a: any, b: any) => (a.scheduled_for || '').localeCompare(b.scheduled_for || '')).slice(0, 10);
        setUpcomingEvents(upcoming);

        const days = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          const dayStr = d.toISOString().split('T')[0];
          const label = d.toLocaleDateString("pt-BR", { weekday: 'short' }).replace('.', '').replace('-feira', '');
          days.push({ date: dayStr, label: label.charAt(0).toUpperCase() + label.slice(1) });
        }
        const newConf = days.map(d => {
          const daily = events.filter((e: any) => (e.scheduled_for || "").startsWith(d.date));
          return {
            day: d.label,
            confirmados: daily.filter((e: any) => e.status === 'confirmed').length,
            cancelados: daily.filter((e: any) => e.status === 'cancelled').length
          };
        });
        setConfirmData(newConf);
      }
      setAlerts(newAlerts);

      // If we got 401s, try to auto-renew token and retry only the failed ones
      // Skip auto renewal for simplicity here since the main logic already has it covered, 
      // but ensure we still try to reload the UI using the fresh tokens.
      const anyFailed401 = [sResult, cResult, wResult, fResult, hResult, eResult].some(
        r => r.status === "rejected" && /401/.test(String(r.reason))
      );
      if (anyFailed401) {
        const renewed = await ensureTokenIfNeeded("401");
        if (renewed) {
          setTimeout(loadDashboard, 100);
        }
      }
    }
    loadDashboard();
  }, []);

  async function openWaConnect() {
    setBusyWa(true);
    try {
      await waPost('/session/connect');
      setQrNonce(Date.now());
      setShowWaModal(true);
    } finally {
      setBusyWa(false);
    }
  }

  const leads = classifications?.new_lead ?? 0;
  const unknown = classifications?.unknown ?? 0;
  const humanPending = classifications?.human_review_pending ?? 0;
  const inboundTotal = summary?.inbound_total ?? 0;

  // Render logic mapping — check if object exists, NOT the value (0 is valid)
  const netTotalDisplay = financeSummary !== null ? `R$ ${financeSummary?.net_total ?? 0}` : "Carregando...";
  const pendingTotalDisplay = financeSummary !== null ? `${financeSummary?.pending_count ?? 0} pendentes` : "Atualizando...";

  return (
    <div className="space-y-6 animate-in-fade">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">Dashboard</h1>
        {waStatus?.status !== "connected" ? (
          <button onClick={openWaConnect} className="liquid-btn liquid-btn-primary text-xs">Conectar WhatsApp</button>
        ) : (
          <span className="text-xs text-success">WhatsApp conectado</span>
        )}
      </div>
      {busyWa && <LoadingState label="Preparando conexão WhatsApp..." />}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard label="Leads Novos" value={leads} change="classificação automática" changeType="positive" icon={Users} />
        <KPICard label="Inbound Total" value={inboundTotal} change="mensagens processadas" changeType="neutral" icon={CheckCircle} />
        <KPICard label="Desconhecidos" value={unknown} change="revisão necessária" changeType={unknown > 0 ? "negative" : "positive"} icon={XCircle} />
        <KPICard label="Receita Líquida" value={netTotalDisplay} change="fluxo ativo" changeType="positive" icon={DollarSign} />
        <KPICard label="A Receber" value={`R$ ${financeSummary?.pending_total ?? 0}`} change={pendingTotalDisplay} changeType={financeSummary?.pending_total > 0 ? "negative" : "positive"} icon={Clock} />
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
        {/* Today appointments (Expandable Calendar Widget) */}
        <div className="lg:col-span-2">
          <DashboardAgenda />
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {/* AI Intent Notifications */}
          <GlassCard className="relative overflow-hidden border-primary/20 backdrop-blur-xl">
            <div className="absolute inset-0 bg-primary/5"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${activeMotor ? 'bg-primary animate-pulse' : 'bg-destructive'}`}></div>
                  <h3 className="text-sm font-semibold text-foreground tracking-wider font-orbitron">L2 // <span>MOTOR</span></h3>
                </div>
                <span className="text-[10px] text-primary/70 uppercase tracking-wider font-bold">Autonomia</span>
              </div>

              {hardware?.cpu === "Unknown CPU" ? (
                <div className="flex flex-col items-center justify-center p-6 bg-black/40 border border-destructive/30 rounded-xl gap-4">
                  <div className="flex flex-col items-center gap-1 text-center">
                    <span className="text-destructive font-bold uppercase tracking-widest text-[10px]">Verificação Necessária</span>
                    <span className="text-foreground/70 text-xs text-balance">O Motor L2 não identificou seu Hardware. O processamento neural pode estar inativo.</span>
                  </div>
                  <button
                    onClick={() => {
                      sessionStorage.setItem("auto_start_scan", "true");
                      window.location.href = "/automacao";
                    }}
                    className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg px-4 py-2 text-[10px] font-bold uppercase transition-colors"
                  >
                    Iniciar Scan de Hardware
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {aiNotifications.length === 0 ? (
                    <div className="text-center p-6 text-xs text-muted-foreground bg-black/20 rounded-xl border border-border/10">
                      O Motor está ativo. Nenhuma interação pendente.
                    </div>
                  ) : (
                    aiNotifications.map((n) => (
                      <div key={n.id} className="bg-black/40 border border-primary/20 rounded-xl p-3 flex flex-col gap-2 relative overflow-hidden group">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-semibold text-foreground">{n.contact_name}</p>
                            <p className="text-[10px] font-mono text-muted-foreground mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">"{n.original_message}"</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[9px] text-white/40">{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider
                              ${n.detected_intent === 'CONFIRM_APPOINTMENT' ? 'bg-emerald-500/20 text-emerald-400' :
                                n.detected_intent === 'CANCEL_APPOINTMENT' ? 'bg-rose-500/20 text-rose-400' :
                                  'bg-primary/20 text-primary'}
                            `}>
                              {(n.confidence * 100).toFixed(0)}% Match
                            </span>
                          </div>
                        </div>

                        <div className="mt-2 pt-2 border-t border-white/5 flex gap-2">
                          <button
                            onClick={() => executeAction(n)}
                            className="flex-1 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg py-1.5 text-[10px] font-bold uppercase transition-colors"
                          >
                            {n.detected_intent === 'CONFIRM_APPOINTMENT' ? `Confirmar Agendamento (${n.extracted_date ? new Date(n.extracted_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'})` :
                              n.detected_intent === 'CANCEL_APPOINTMENT' ? 'Cancelar e Oferecer Remarcação' :
                                'Processar'}
                          </button>
                          <button
                            onClick={() => dismissNotification(n.id)}
                            className="w-8 flex items-center justify-center bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground border border-white/10 rounded-lg transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </GlassCard>

          {/* Alerts */}
          < GlassCard >
            <h3 className="text-sm font-semibold text-foreground mb-3">Alertas Operacionais</h3>
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg text-xs ${a.type === "error" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                  }`}>
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>{a.msg}</span>
                </div>
              ))}
            </div>
          </GlassCard >
        </div >
      </div >

      {/* New Widgets Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Today's Schedule Summary */}
        <GlassCard className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Agenda de Hoje
            </h3>
            <span className="text-xs text-muted-foreground">{todayEvents.length} agendamentos</span>
          </div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {todayEvents.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                Nenhum agendamento para hoje
              </div>
            ) : (
              todayEvents.slice(0, 6).map((event) => (
                <div key={event.id} className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-foreground">
                      {event.scheduled_for ? new Date(event.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </span>
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">{event.full_name || 'Cliente'}</span>
                  </div>
                  <StatusPill status={event.status} />
                </div>
              ))
            )}
          </div>
        </GlassCard>

        {/* Upcoming Appointments (Next 3 Days) */}
        <GlassCard className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-success" />
              Próximos 3 Dias
            </h3>
            <span className="text-xs text-muted-foreground">{upcomingEvents.length} agendamentos</span>
          </div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                Nenhum agendamento futuro
              </div>
            ) : (
              upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {event.scheduled_for ? new Date(event.scheduled_for).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '--/--'}
                    </span>
                    <span className="text-xs text-foreground">
                      {event.scheduled_for ? new Date(event.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </span>
                    <span className="text-xs text-muted-foreground truncate max-w-[100px]">{event.full_name || 'Cliente'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Recent Activity Feed */}
        <GlassCard className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Shield className="h-4 w-4 text-warning" />
              Atividade Recente
            </h3>
            <span className="text-xs text-muted-foreground">{auditLogs.length} eventos</span>
          </div>
          <div className="space-y-2 max-h-[220px] overflow-y-auto">
            {auditLogs.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                Nenhuma atividade recente
              </div>
            ) : (
              auditLogs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 bg-black/20 rounded-lg">
                  <div className="mt-0.5">
                    <Activity className="h-3 w-3 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground truncate">{log.action?.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{log.resource}</span>
                      <span className="text-[10px] text-primary/60">•</span>
                      <span className="text-[10px] text-muted-foreground truncate">{log.resource_id?.substring(0, 8) || '-'}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>

        {/* System Health Indicator */}
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Cpu className="h-4 w-4 text-destructive" />
              Saúde do Sistema
            </h3>
          </div>
          <div className="space-y-3">
            {systemHealth ? (
              <>
                <div className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Database className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-foreground">Banco de Dados</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${systemHealth.db_ok ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                    {systemHealth.db_ok ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Wifi className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-foreground">Redis</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${systemHealth.redis_ok ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                    {systemHealth.redis_ok ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-foreground">WhatsApp</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${systemHealth.wa_ok ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                    {systemHealth.wa_ok ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-foreground">Fila de Revisão</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${systemHealth.queue_empty ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                    {systemHealth.queue_empty ? 'Vazia' : 'Pendente'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Zap className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-foreground">Sem Erros (1h)</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${systemHealth.no_critical ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                    {systemHealth.no_critical ? 'OK' : 'Erros'}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-center py-4 text-xs text-muted-foreground">
                Carregando status...
              </div>
            )}
          </div>
        </GlassCard>

        {/* Quick Actions Panel */}
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Ações Rápidas
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => window.location.href = '/agenda?action=new'}
              className="flex flex-col items-center justify-center p-3 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4 text-primary mb-1" />
              <span className="text-[10px] text-primary font-medium">Novo Agendamento</span>
            </button>
            <button
              onClick={() => window.location.href = '/leads?action=new'}
              className="flex flex-col items-center justify-center p-3 bg-success/10 hover:bg-success/20 border border-success/20 rounded-lg transition-colors"
            >
              <Users className="h-4 w-4 text-success mb-1" />
              <span className="text-[10px] text-success font-medium">Novo Lead</span>
            </button>
            <button
              onClick={() => window.location.href = '/finance?action=new'}
              className="flex flex-col items-center justify-center p-3 bg-warning/10 hover:bg-warning/20 border border-warning/20 rounded-lg transition-colors"
            >
              <DollarSign className="h-4 w-4 text-warning mb-1" />
              <span className="text-[10px] text-warning font-medium">Nova Transação</span>
            </button>
            <button
              onClick={() => window.location.href = '/auditoria'}
              className="flex flex-col items-center justify-center p-3 bg-muted/10 hover:bg-muted/20 border border-muted/20 rounded-lg transition-colors"
            >
              <Shield className="h-4 w-4 text-muted-foreground mb-1" />
              <span className="text-[10px] text-muted-foreground font-medium">Ver Auditoria</span>
            </button>
            <button
              onClick={() => window.location.href = '/automacao'}
              className="flex flex-col items-center justify-center p-3 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg transition-colors"
            >
              <Cpu className="h-4 w-4 text-purple-500 mb-1" />
              <span className="text-[10px] text-purple-500 font-medium">Automação</span>
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex flex-col items-center justify-center p-3 bg-muted/10 hover:bg-muted/20 border border-muted/20 rounded-lg transition-colors"
            >
              <RefreshCw className="h-4 w-4 text-muted-foreground mb-1" />
              <span className="text-[10px] text-muted-foreground font-medium">Atualizar</span>
            </button>
          </div>
        </GlassCard>
      </div>

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
      )
      }
    </div >
  );
}
