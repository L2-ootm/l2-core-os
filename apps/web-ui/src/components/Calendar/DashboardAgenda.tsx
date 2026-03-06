import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence, Transition } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusPill } from "@/components/ui/status-pill";
import { Maximize2, Minimize2, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { L2BigCalendar, CalendarEvent } from "@/components/Calendar/L2BigCalendar";
import { apiGet } from "@/lib/api";

type EventItem = {
    id: string;
    entity_id: string;
    full_name?: string;
    status: string;
    scheduled_for?: string | null;
};

// Custom extremely snappy physics curve for the L2 Brand
const l2Transition: Transition = {
    type: "tween",
    ease: [0.22, 1, 0.36, 1],
    duration: 0.6
};

export function DashboardAgenda() {
    const [isExpanded, setIsExpanded] = useState(false);
    const [items, setItems] = useState<EventItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchAgenda() {
            try {
                const res = await apiGet<{ ok: boolean; items: EventItem[] }>("/events/list?limit=100");
                setItems(res.items || []);
            } catch (error) {
                console.error("Failed to load dashboard agenda", error);
            } finally {
                setLoading(false);
            }
        }
        fetchAgenda();
    }, []);

    const calendarEvents = useMemo<CalendarEvent[]>(() => {
        return items.map(e => {
            const start = e.scheduled_for ? new Date(e.scheduled_for) : new Date();
            const end = new Date(start.getTime() + 60 * 60 * 1000);
            return {
                id: e.id,
                title: e.full_name || "Sem nome",
                start,
                end,
                raw: e
            };
        });
    }, [items]);

    // Today's appointments for the compact view
    const todaysAppointments = useMemo(() => {
        const today = new Date();
        return items.filter(i => {
            if (!i.scheduled_for) return false;
            const d = new Date(i.scheduled_for);
            return d.getDate() === today.getDate() &&
                d.getMonth() === today.getMonth() &&
                d.getFullYear() === today.getFullYear();
        }).sort((a, b) => (a.scheduled_for || "").localeCompare(b.scheduled_for || ""));
    }, [items]);

    return (
        <>
            {/* Compact View Widget */}
            <GlassCard className="relative overflow-hidden group h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">Consultas Hoje</h3>
                    </div>
                    <button
                        onClick={() => setIsExpanded(true)}
                        className="p-1.5 rounded-md bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors opacity-0 group-hover:opacity-100"
                        title="Expandir Calendário"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>
                </div>

                <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                    {loading ? (
                        <div className="flex items-center justify-center p-8 text-muted-foreground">
                            <Loader2 className="w-5 h-5 animate-spin" />
                        </div>
                    ) : todaysAppointments.length === 0 ? (
                        <div className="text-center p-8 text-xs text-muted-foreground bg-black/20 rounded-xl border border-border/10">
                            Agenda livre hoje.
                        </div>
                    ) : (
                        todaysAppointments.map((apt) => {
                            const date = apt.scheduled_for ? new Date(apt.scheduled_for) : new Date();
                            const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                            return (
                                <div key={apt.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-border/30 transition-colors cursor-pointer" onClick={() => setIsExpanded(true)}>
                                    <span className="text-xs font-mono text-muted-foreground w-12">{time}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">{apt.full_name}</p>
                                    </div>
                                    <StatusPill status={apt.status} className="scale-90" />
                                </div>
                            );
                        })
                    )}
                </div>
            </GlassCard>

            {/* Expanded Modal View using Framer Motion */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-6"
                    >
                        <motion.div
                            layoutId="agenda-expansion"
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            transition={l2Transition}
                            className="w-full max-w-[1400px] h-[90vh] bg-[#0A0A0A] border border-border/30 shadow-2xl rounded-2xl overflow-hidden flex flex-col"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b border-border/30 bg-black/40">
                                <div className="flex items-center gap-3">
                                    <div className="bg-primary/20 p-2 rounded-lg border border-primary/30">
                                        <CalendarIcon className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-foreground font-orbitron tracking-wider">L2 // CENTRAL CALENDAR</h2>
                                        <p className="text-xs text-muted-foreground font-mono">Macro Visualization System</p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setIsExpanded(false)}
                                    className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-2"
                                >
                                    <Minimize2 className="w-3.5 h-3.5" />
                                    Fechar
                                </button>
                            </div>

                            {/* Body */}
                            <div className="flex-1 p-4 bg-black/20">
                                <L2BigCalendar
                                    events={calendarEvents}
                                    onSelectEvent={(cEvent) => {
                                        console.log("Selected from expanded calendar", cEvent);
                                        // In the actual app this would trigger the edit modal, similar to Agenda.tsx
                                    }}
                                />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
