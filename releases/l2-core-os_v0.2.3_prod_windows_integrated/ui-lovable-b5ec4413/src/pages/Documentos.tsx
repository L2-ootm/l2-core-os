import { GlassCard } from "@/components/ui/glass-card";
import { FileText, Plus, Download, Eye, Clock } from "lucide-react";

const documents = [
  { type: "Contrato", patient: "Maria Silva", date: "05/03/2026 14:30", hash: "a1b2c3...f4e5", version: "v2.1" },
  { type: "Proposta", patient: "Rafael Costa", date: "04/03/2026 10:15", hash: "d6e7f8...b9c0", version: "v1.0" },
  { type: "Recibo", patient: "Beatriz Lima", date: "04/03/2026 16:45", hash: "g1h2i3...j4k5", version: "v1.0" },
  { type: "Contrato", patient: "Fernando Oliveira", date: "03/03/2026 09:00", hash: "l6m7n8...o9p0", version: "v3.0" },
  { type: "Recibo", patient: "Carlos Pereira", date: "02/03/2026 11:30", hash: "q1r2s3...t4u5", version: "v1.0" },
];

const templates = [
  { name: "Contrato Padrão", version: "v2.1", updated: "01/03/2026" },
  { name: "Proposta Comercial", version: "v1.3", updated: "28/02/2026" },
  { name: "Recibo de Pagamento", version: "v1.0", updated: "15/02/2026" },
];

export default function Documentos() {
  return (
    <div className="space-y-6 animate-in-fade">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">Documentos</h1>
        <button className="liquid-btn liquid-btn-primary flex items-center gap-2 text-xs">
          <Plus className="h-3.5 w-3.5" /> Gerar Documento
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <GlassCard className="!p-0 overflow-hidden">
            <div className="p-4 border-b border-border/30">
              <h3 className="text-sm font-semibold text-foreground">Documentos Emitidos</h3>
            </div>
            <table className="premium-table">
              <thead>
                <tr><th>Tipo</th><th>Paciente</th><th>Data/Hora</th><th>Hash</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {documents.map((d, i) => (
                  <tr key={i}>
                    <td>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        {d.type}
                      </span>
                    </td>
                    <td className="text-sm text-foreground">{d.patient}</td>
                    <td className="text-xs text-muted-foreground">{d.date}</td>
                    <td className="text-xs font-mono text-muted-foreground">{d.hash}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button className="liquid-btn-ghost p-1.5 rounded-lg"><Eye className="h-3.5 w-3.5" /></button>
                        <button className="liquid-btn-ghost p-1.5 rounded-lg"><Download className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassCard>
        </div>

        <GlassCard>
          <h3 className="text-sm font-semibold text-foreground mb-4">Templates</h3>
          <div className="space-y-3">
            {templates.map((t, i) => (
              <div key={i} className="p-3 rounded-xl glass-subtle">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">{t.name}</span>
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t.version}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Atualizado: {t.updated}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
