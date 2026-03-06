import { GlassCard } from "@/components/ui/glass-card";
import { StatusPill } from "@/components/ui/status-pill";
import { Plus, Filter } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";

const stages = ["Novo", "Qualificado", "Agendado", "Em Atendimento", "Fechado", "Perdido"];

type LeadItem = {
  id: string;
  full_name: string;
  contact_phone: string;
  type: string;
  classification: string;
};

function stageFor(item: LeadItem): string {
  if (item.type === "archived") return "Perdido";
  if (item.classification === "known_client") return "Qualificado";
  if (item.type === "active") return "Agendado";
  return "Novo";
}

const stageColors: Record<string, string> = {
  "Novo": "border-primary/30",
  "Qualificado": "border-warning/30",
  "Agendado": "border-success/30",
  "Em Atendimento": "border-primary/30",
  "Fechado": "border-success/30",
  "Perdido": "border-destructive/30",
};

export default function LeadsCRM() {
  const [items, setItems] = useState<LeadItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiGet<{ ok: boolean; items: LeadItem[] }>("/entities/list?limit=300");
        setItems(r.items || []);
      } catch (e: any) {
        setError(String(e.message || e));
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    const base: Record<string, LeadItem[]> = Object.fromEntries(stages.map(s => [s, []]));
    for (const it of items) base[stageFor(it)].push(it);
    return base;
  }, [items]);

  return (
    <div className="space-y-6 animate-in-fade">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Pipeline de Leads</h1>
          <p className="text-xs text-muted-foreground">Dados reais da base de entidades/classificação</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="liquid-btn-ghost flex items-center gap-2 text-xs"><Filter className="h-3.5 w-3.5" /> Filtros</button>
          <button className="liquid-btn liquid-btn-primary flex items-center gap-2 text-xs"><Plus className="h-3.5 w-3.5" /> Novo Lead</button>
        </div>
      </div>

      {error && <GlassCard className="text-xs text-destructive">Erro: {error}</GlassCard>}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map(stage => (
          <div key={stage} className="min-w-[260px] flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{stage}</h3>
              <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{grouped[stage]?.length || 0}</span>
            </div>
            <div className="space-y-2">
              {(grouped[stage] || []).map((lead) => (
                <GlassCard key={lead.id} hover className={`!p-3.5 border-l-2 ${stageColors[stage]}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-foreground">{lead.full_name}</p>
                    <StatusPill status={lead.classification || "unknown"} />
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">Tipo: {lead.type}</p>
                  <p className="text-[11px] text-muted-foreground/70">{lead.contact_phone}</p>
                </GlassCard>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
