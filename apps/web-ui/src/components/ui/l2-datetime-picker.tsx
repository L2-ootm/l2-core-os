import * as React from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Calendar as CalendarIcon, Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function L2DateTimePicker({ value, onChange }: { value: string, onChange: (v: string) => void }) {
    // value is expected to be ISO string like "2024-03-05T14:30"

    const dateValue = value ? new Date(value) : undefined;

    const [date, setDate] = React.useState<Date | undefined>(dateValue);
    const [hour, setHour] = React.useState<string>(value ? value.substring(11, 13) : "09");
    const [minute, setMinute] = React.useState<string>(value ? value.substring(14, 16) : "00");

    const hours = Array.from({ length: 15 }, (_, i) => (i + 6).toString().padStart(2, '0')); // 06 to 20
    const minutes = ["00", "15", "30", "45"];

    React.useEffect(() => {
        if (date) {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            onChange(`${year}-${month}-${day}T${hour}:${minute}`);
        }
    }, [date, hour, minute]);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    className={cn(
                        "w-full bg-secondary/50 rounded-xl px-3 py-2.5 text-sm flex items-center justify-start text-left hover:bg-secondary/70 transition-colors border border-border/30 hover:border-primary/50",
                        !date && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4 opacity-50 text-primary" />
                    {date ? format(date, "PPP 'às' HH:mm", { locale: ptBR }) : <span>Selecione a data e hora</span>}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-black/95 backdrop-blur-xl border-primary/20 z-[100]" align="start">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    className="bg-transparent text-foreground p-3"
                />
                <div className="p-3 border-t border-border/30 flex items-center justify-between gap-2 bg-secondary/10">
                    <div className="flex items-center gap-2 text-primary">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm font-medium">Horário</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Select value={hour} onValueChange={setHour}>
                            <SelectTrigger className="w-[70px] bg-secondary/50 border-none h-8 text-xs">
                                <SelectValue placeholder="HH" />
                            </SelectTrigger>
                            <SelectContent className="bg-black/95 backdrop-blur-xl border-primary/20 max-h-[200px]">
                                {hours.map((h) => (
                                    <SelectItem key={h} value={h} className="text-xs hover:bg-primary/20">{h}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="text-muted-foreground font-bold">:</span>
                        <Select value={minute} onValueChange={setMinute}>
                            <SelectTrigger className="w-[70px] bg-secondary/50 border-none h-8 text-xs">
                                <SelectValue placeholder="MM" />
                            </SelectTrigger>
                            <SelectContent className="bg-black/95 backdrop-blur-xl border-primary/20">
                                {minutes.map((m) => (
                                    <SelectItem key={m} value={m} className="text-xs hover:bg-primary/20">{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
