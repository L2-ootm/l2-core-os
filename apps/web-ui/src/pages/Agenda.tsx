import { GlassCard } from "@/components/ui/glass-card";
import { StatusPill } from "@/components/ui/status-pill";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

type EventItem = {
  id: string;
  full_name?: string;
  status: string;
  scheduled_for?: string | null;
};

export default function Agenda() {
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiGet<{ ok: boolean; items: EventItem[] }>("/events/list?limit=200");
        setEvents(r.items || []);
      } catch {
        setEvents([]);
      }
    })();
  }, []);

  return (
    <div className="space-y-6 animate-in-fade">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="liquid-btn-ghost p-2 rounded-xl"><ChevronLeft className="h-4 w-4" /></button>
          <h2 className="text-sm font-semibold text-foreground">Agenda Operacional</h2>
          <button className="liquid-btn-ghost p-2 rounded-xl"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <button className="liquid-btn liquid-btn-primary flex items-center gap-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> Agendar</button>
      </div>

      <GlassCard className="!p-0 overflow-hidden">
        <table className="premium-table">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Agendado para</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td className="text-sm text-foreground">{e.full_name || "Sem nome"}</td>
                <td className="text-xs text-muted-foreground">{e.scheduled_for || "--"}</td>
                <td><StatusPill status={e.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
