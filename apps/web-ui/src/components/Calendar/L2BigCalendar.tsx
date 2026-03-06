import { useState } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop, { withDragAndDropProps } from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import moment from 'moment';
import 'moment/locale/pt-br';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { GlassCard } from '@/components/ui/glass-card';
import { StatusPill } from '@/components/ui/status-pill';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { MessageCircle, Edit3, Trash2 } from 'lucide-react';
import './L2CalendarV2Styles.css';

moment.locale('pt-br');
const localizer = momentLocalizer(moment);

export type CalendarEvent = {
    id: string;
    title: string;
    start: Date;
    end: Date;
    resourceId?: string;
    raw: any; // Raw db event
};

const EventComponent = ({ event, onSelectEvent, onDeleteEvent }: { event: CalendarEvent, onSelectEvent?: (e: CalendarEvent) => void, onDeleteEvent?: (e: CalendarEvent) => void }) => {
    const handleWhatsApp = (e: React.MouseEvent) => {
        e.stopPropagation(); // prevent opening the modal
        console.log("SEND WHATSAPP TO", event.raw.contact_phone);
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <div className="flex flex-col h-full group p-1 w-full text-left cursor-pointer">
                    <div className="flex justify-between items-start">
                        <span className="font-semibold text-xs truncate max-w-[80%]">{event.title}</span>
                    </div>
                    <div className="mt-auto flex items-center justify-between">
                        <StatusPill status={event.raw.status} className="scale-75 origin-bottom-left" />
                    </div>
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 bg-black/90 backdrop-blur-xl border-primary/20 shadow-2xl z-50">
                <div className="space-y-3">
                    <div>
                        <h4 className="font-bold text-sm text-foreground">{event.title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{event.raw.contact_phone || "Sem telefone"}</p>
                    </div>

                    <div className="py-1">
                        <StatusPill status={event.raw.status} />
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10">
                        <button
                            onClick={(e) => { e.stopPropagation(); if (onSelectEvent) onSelectEvent(event); }}
                            className="flex items-center justify-center gap-1.5 p-1.5 rounded-lg bg-secondary/40 hover:bg-secondary/60 text-xs text-foreground transition-colors"
                        >
                            <Edit3 className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button
                            onClick={handleWhatsApp}
                            className="flex items-center justify-center gap-1.5 p-1.5 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] text-xs transition-colors"
                        >
                            <MessageCircle className="w-3.5 h-3.5" /> Msg
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); if (onDeleteEvent) onDeleteEvent(event); }}
                            className="flex items-center justify-center gap-1.5 p-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs transition-colors"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Excluir
                        </button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};

const DnDCalendar = withDragAndDrop<CalendarEvent, object>(Calendar);

interface L2BigCalendarProps extends Omit<withDragAndDropProps<CalendarEvent, object>, 'localizer' | 'events' | 'onEventDrop' | 'onEventResize' | 'onSelectSlot'> {
    events: CalendarEvent[];
    resources?: any[];
    onSelectEvent: (event: CalendarEvent) => void;
    onDeleteEvent?: (event: CalendarEvent) => void;
    onSelectSlot?: (slotInfo: any) => void;
    onEventDrop?: (args: { event: CalendarEvent; start: string | Date; end: string | Date; isAllDay: boolean; resourceId?: string }) => void;
    onEventResize?: (args: { event: CalendarEvent; start: string | Date; end: string | Date; isAllDay: boolean }) => void;
}

export function L2BigCalendar({ events, resources, onSelectEvent, onDeleteEvent, onSelectSlot, onEventDrop, onEventResize, ...props }: L2BigCalendarProps) {
    // Military Grade bounds: 06:00 to 20:00
    const minTime = new Date();
    minTime.setHours(6, 0, 0);
    const maxTime = new Date();
    maxTime.setHours(20, 0, 0);

    const [currentView, setCurrentView] = useState<string>(Views.DAY);

    // Resources only in Day view — Week view with resources = 14+ columns = broken layout
    const activeResources = currentView === Views.DAY ? resources : undefined;

    return (
        <div className="h-full w-full flex flex-col l2-calendar-v2-wrapper">
            <DnDCalendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ flex: 1 }}
                views={[Views.MONTH, Views.WEEK, Views.DAY]}
                defaultView={Views.DAY}
                view={currentView as any}
                onView={(v) => setCurrentView(v)}
                resources={activeResources}
                resourceIdAccessor={(r: any) => r.id}
                resourceTitleAccessor={(r: any) => r.title}
                onSelectEvent={onSelectEvent}
                onSelectSlot={onSelectSlot}
                onEventDrop={onEventDrop}
                onEventResize={onEventResize}
                resizable
                selectable
                step={30}
                timeslots={2}
                min={minTime}
                max={maxTime}
                formats={{
                    timeGutterFormat: (date: Date) =>
                        date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }),
                    eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
                        `${start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })} — ${end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })}`,
                    dayHeaderFormat: (date: Date) =>
                        date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }),
                    dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
                        `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`,
                }}
                components={{
                    event: (props) => <EventComponent {...props} onSelectEvent={onSelectEvent} onDeleteEvent={onDeleteEvent} />,
                    resourceHeader: ({ label }: { label: React.ReactNode }) => (
                        <div className="flex items-center justify-center py-2 px-4 rounded-t-lg bg-white/5 border-b border-white/10 text-xs font-semibold text-foreground tracking-widest uppercase mb-1">
                            {label}
                        </div>
                    ),
                }}
                messages={{
                    next: "Próximo",
                    previous: "Anterior",
                    today: "Hoje",
                    month: "Mês",
                    week: "Semana",
                    day: "Dia",
                    agenda: "Agenda",
                    date: "Data",
                    time: "Hora",
                    event: "Evento",
                    noEventsInRange: "Não há agendamentos neste período.",
                }}
                eventPropGetter={(event) => {
                    let bgColor = 'hsla(217, 91%, 60%, 0.15)';
                    let borderColor = 'hsla(217, 91%, 60%, 0.5)';

                    if (event.raw.status === 'confirmed') { bgColor = 'hsla(160, 60%, 45%, 0.15)'; borderColor = 'hsla(160, 60%, 45%, 0.5)'; }
                    if (event.raw.status === 'canceled' || event.raw.status === 'no_show') { bgColor = 'hsla(0, 72%, 51%, 0.15)'; borderColor = 'hsla(0, 72%, 51%, 0.5)'; }

                    return {
                        className: 'rounded-lg backdrop-blur-sm shadow-sm transition-all hover:brightness-125',
                        style: {
                            backgroundColor: bgColor,
                            borderLeft: `3px solid ${borderColor}`,
                            border: `1px solid ${borderColor}`,
                            color: 'hsl(210, 40%, 96%)',
                        }
                    };
                }}
                {...props}
            />
        </div>
    );
}
