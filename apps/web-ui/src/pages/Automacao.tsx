import { GlassCard } from "@/components/ui/glass-card";
import { StatusPill } from "@/components/ui/status-pill";
import { Cpu, Zap, ArrowRight, Activity, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

const rules = [
  { intent: "confirm", action: "status → confirmed", confidence: "98%", executions: 342, status: "confirmed" },
  { intent: "cancel", action: "status → canceled", confidence: "96%", executions: 87, status: "canceled" },
  { intent: "reschedule", action: "status → reschedule_requested", confidence: "91%", executions: 54, status: "reschedule_requested" },
  { intent: "low_confidence", action: "→ human_review", confidence: "<70%", executions: 23, status: "human_review" },
];

const aiBlocks = [
  { name: "Confirmar", desc: "Detecta intenção de confirmação e atualiza agenda", tier: "A", p95: "120ms" },
  { name: "Cancelar", desc: "Processa cancelamentos com motivo", tier: "A", p95: "95ms" },
  { name: "Remarcar", desc: "Extrai nova data/horário e sugere alternativas", tier: "B", p95: "280ms" },
  { name: "Triagem", desc: "Classifica lead e roteia para fila adequada", tier: "B", p95: "350ms" },
];

const logs = [
  { time: "14:03", rule: "confirm", input: "confirmo presença", result: "✅ confirmed", latency: "89ms" },
  { time: "13:45", rule: "reschedule", input: "preciso remarcar para sexta", result: "⚠️ reschedule_requested", latency: "245ms" },
  { time: "13:12", rule: "low_confidence", input: "vocês fazem exame?", result: "🔍 human_review", latency: "310ms" },
  { time: "12:58", rule: "cancel", input: "não vou poder ir", result: "❌ canceled", latency: "102ms" },
];

export default function Automacao() {
  return (
    <div className="space-y-6 animate-in-fade">
      <h1 className="text-lg font-bold text-foreground">Automação & IA</h1>

      {/* Rules */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Regras de Automação</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {rules.map((r, i) => (
            <GlassCard key={i} hover>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground capitalize">{r.intent}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <span>Intenção</span>
                <ArrowRight className="h-3 w-3" />
                <span>{r.action}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Confiança: {r.confidence}</span>
                <span className="text-xs text-muted-foreground">{r.executions} exec.</span>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* AI Blocks */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Blocos de IA</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {aiBlocks.map((block, i) => (
            <GlassCard key={i}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">{block.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">Tier {block.tier}</span>
                  <span className="text-[10px] text-muted-foreground">p95: {block.p95}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{block.desc}</p>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Logs */}
      <GlassCard className="!p-0 overflow-hidden">
        <div className="p-4 border-b border-border/30">
          <h3 className="text-sm font-semibold text-foreground">Logs de Execução</h3>
        </div>
        <table className="premium-table">
          <thead>
            <tr><th>Hora</th><th>Regra</th><th>Input</th><th>Resultado</th><th>Latência</th></tr>
          </thead>
          <tbody>
            {logs.map((l, i) => (
              <tr key={i}>
                <td className="text-xs font-mono text-muted-foreground">{l.time}</td>
                <td className="text-xs font-medium text-foreground">{l.rule}</td>
                <td className="text-xs text-muted-foreground">{l.input}</td>
                <td className="text-xs">{l.result}</td>
                <td className="text-xs text-muted-foreground">{l.latency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
