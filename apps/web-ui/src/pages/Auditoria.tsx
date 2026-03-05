import { GlassCard } from "@/components/ui/glass-card";
import { Shield, CheckCircle, XCircle, AlertTriangle, Activity, Play, Clock } from "lucide-react";

const healthServices = [
  { name: "API Backend", status: "online", latency: "45ms" },
  { name: "Database (PostgreSQL)", status: "online", latency: "12ms" },
  { name: "Redis Cache", status: "online", latency: "3ms" },
  { name: "WhatsApp Gateway", status: "degraded", latency: "890ms" },
];

const auditLog = [
  { time: "14:05", user: "Dr. Ricardo", action: "Confirmou consulta #1847", type: "info" },
  { time: "14:03", user: "Sistema IA", action: "Classificou lead como known_client", type: "info" },
  { time: "13:58", user: "Dr. Ricardo", action: "Gerou contrato para Maria Silva", type: "info" },
  { time: "13:45", user: "Sistema", action: "Gateway WhatsApp reconectado (tentativa 3)", type: "warning" },
  { time: "13:30", user: "Sistema", action: "Falha de conexão WhatsApp Gateway", type: "error" },
  { time: "13:12", user: "Sistema IA", action: "Encaminhou mensagem para revisão humana", type: "warning" },
];

const goNoGoChecks = [
  { item: "API Backend respondendo", pass: true },
  { item: "Database acessível", pass: true },
  { item: "Redis disponível", pass: true },
  { item: "WhatsApp Gateway estável", pass: false },
  { item: "Fila de mensagens vazia", pass: true },
  { item: "Certificados SSL válidos", pass: true },
  { item: "Backup recente (<24h)", pass: true },
  { item: "Sem erros críticos (1h)", pass: false },
];

export default function Auditoria() {
  return (
    <div className="space-y-6 animate-in-fade">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">Auditoria & Saúde do Sistema</h1>
        <button className="liquid-btn liquid-btn-primary flex items-center gap-2 text-xs">
          <Play className="h-3.5 w-3.5" /> Rodar GO/NO-GO
        </button>
      </div>

      {/* Health Status */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {healthServices.map((s, i) => (
          <GlassCard key={i}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">{s.name}</span>
              {s.status === "online" ? (
                <CheckCircle className="h-4 w-4 text-success" />
              ) : s.status === "degraded" ? (
                <AlertTriangle className="h-4 w-4 text-warning" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${
                s.status === "online" ? "text-success" : s.status === "degraded" ? "text-warning" : "text-destructive"
              }`}>
                {s.status === "online" ? "Online" : s.status === "degraded" ? "Degradado" : "Offline"}
              </span>
              <span className="text-xs text-muted-foreground">{s.latency}</span>
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Audit log */}
        <GlassCard className="lg:col-span-2 !p-0 overflow-hidden">
          <div className="p-4 border-b border-border/30">
            <h3 className="text-sm font-semibold text-foreground">Linha do Tempo de Auditoria</h3>
          </div>
          <div className="divide-y divide-border/20">
            {auditLog.map((entry, i) => (
              <div key={i} className="flex items-start gap-3 p-4">
                <div className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${
                  entry.type === "error" ? "bg-destructive" : entry.type === "warning" ? "bg-warning" : "bg-primary/50"
                }`} />
                <div className="flex-1">
                  <p className="text-sm text-foreground">{entry.action}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">{entry.user}</span>
                    <span className="text-[10px] text-muted-foreground/50">•</span>
                    <span className="text-[10px] text-muted-foreground">{entry.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* GO/NO-GO */}
        <GlassCard>
          <h3 className="text-sm font-semibold text-foreground mb-4">Checklist GO/NO-GO</h3>
          <div className="space-y-2.5">
            {goNoGoChecks.map((c, i) => (
              <div key={i} className="flex items-center gap-2.5">
                {c.pass ? (
                  <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                )}
                <span className={`text-xs ${c.pass ? "text-foreground" : "text-destructive"}`}>{c.item}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-xl bg-warning/10 border border-warning/20">
            <p className="text-xs font-medium text-warning">⚠️ NO-GO — 2 itens falharam</p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
