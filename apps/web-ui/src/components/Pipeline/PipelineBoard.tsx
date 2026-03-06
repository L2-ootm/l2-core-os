import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusPill } from "@/components/ui/status-pill";
import { MoreHorizontal, MessageCircle, Calendar } from "lucide-react";
import { useState, useEffect, useMemo } from "react";

// Using the same types from LeadsCRM for now, will refactor types later
type Client = {
    id: string;
    full_name: string;
    contact_phone: string;
    type: string;
    classification: string;
    updated_at?: string;
    origin?: string;
    ticket_tier?: string;
};

export const PIPELINE_STAGES = [
    "Lead Frio",
    "Em Contato",
    "Agendado",
    "Compareceu",
    "Faltou (Cancelado)"
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

const STAGE_COLORS: Record<PipelineStage, string> = {
    "Lead Frio": "border-t-sky-500/50",
    "Em Contato": "border-t-amber-500/50",
    "Agendado": "border-t-violet-500/50",
    "Compareceu": "border-t-emerald-500/50",
    "Faltou (Cancelado)": "border-t-rose-500/50",
};

interface PipelineBoardProps {
    items: Client[];
    onDragEnd: (result: DropResult) => void;
    onCardClick: (client: Client) => void;
}

export function PipelineBoard({ items, onDragEnd, onCardClick }: PipelineBoardProps) {
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        const animation = requestAnimationFrame(() => setEnabled(true));
        return () => {
            cancelAnimationFrame(animation);
            setEnabled(false);
        };
    }, []);

    // Group items by stage. In a real app we'd map classification/type to these specific stages,
    // or have a dedicated 'stage' field on the Client entity.
    // For this prototype, we'll assign a random stage if they don't have one mapped perfectly yet, 
    // or infer from type.
    const grouped = useMemo(() => {
        const base: Record<PipelineStage, Client[]> = {
            "Lead Frio": [],
            "Em Contato": [],
            "Agendado": [],
            "Compareceu": [],
            "Faltou (Cancelado)": [],
        };

        items.forEach(item => {
            let stage: PipelineStage = "Lead Frio";
            if (item.type === "archived") stage = "Faltou (Cancelado)";
            else if (item.classification === "known_client") stage = "Compareceu";
            else if (item.classification === "new_lead") stage = "Em Contato";
            else if (item.type === "active") stage = "Agendado";

            base[stage].push(item);
        });

        return base;
    }, [items]);

    if (!enabled) return null;

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4 pt-2 -mx-2 px-2 snap-x">
                {PIPELINE_STAGES.map((stage) => (
                    <div key={stage} className="min-w-[320px] w-[320px] flex-shrink-0 flex flex-col snap-start">
                        <div className={`mb-3 px-3 py-2 rounded-lg bg-black/40 border-t-2 ${STAGE_COLORS[stage]} border-x border-b border-border/20 flex items-center justify-between backdrop-blur-md`}>
                            <h3 className="text-sm font-semibold text-foreground tracking-wide">{stage}</h3>
                            <div className="bg-white/10 text-white/70 text-xs font-mono px-2 py-0.5 rounded-full">
                                {grouped[stage].length}
                            </div>
                        </div>

                        <Droppable droppableId={stage}>
                            {(provided, snapshot) => (
                                <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    className={`flex-1 min-h-[500px] rounded-xl transition-colors duration-300 p-2 
                    ${snapshot.isDraggingOver ? 'bg-secondary/20 border border-primary/30 border-dashed' : 'bg-transparent'}`}
                                >
                                    <div className="space-y-3">
                                        {grouped[stage].map((client, index) => (
                                            <Draggable key={client.id} draggableId={client.id} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        className={`transition-all duration-200 ${snapshot.isDragging ? 'rotate-2 scale-105 shadow-2xl shadow-black/80 z-50' : ''}`}
                                                        style={{ ...provided.draggableProps.style }}
                                                        onClick={() => onCardClick(client)}
                                                    >
                                                        <GlassCard className={`p-4 cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors border-border/30 bg-[#0F0F0F]/90 backdrop-blur-xl group`}>
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div className="space-y-1">
                                                                    <h4 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">{client.full_name}</h4>
                                                                    <p className="text-xs text-muted-foreground font-mono">{client.contact_phone}</p>
                                                                </div>
                                                                <button className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </button>
                                                            </div>

                                                            <div className="flex gap-2 mb-3">
                                                                <StatusPill status={client.classification || "unknown"} />
                                                                {client.ticket_tier === 'High Ticket' && (
                                                                    <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase font-bold tracking-wider">High Ticket</span>
                                                                )}
                                                            </div>

                                                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/20">
                                                                <div className="flex gap-2">
                                                                    <button className="text-muted-foreground hover:text-[#25D366] transition-colors p-1" title="WhatsApp">
                                                                        <MessageCircle className="h-4 w-4" />
                                                                    </button>
                                                                    <button className="text-muted-foreground hover:text-primary transition-colors p-1" title="Agendar">
                                                                        <Calendar className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    {client.updated_at ? new Date(client.updated_at).toLocaleDateString() : 'Hoje'}
                                                                </span>
                                                            </div>
                                                        </GlassCard>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                </div>
                            )}
                        </Droppable>
                    </div>
                ))}
            </div>
        </DragDropContext>
    );
}
