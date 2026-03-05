import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  LayoutDashboard, Users, Calendar, MessageCircle, DollarSign,
  Cpu, FileText, Settings, Shield, Search
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const commands = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Leads & CRM", icon: Users, path: "/leads" },
  { label: "Agenda & Atendimentos", icon: Calendar, path: "/agenda" },
  { label: "WhatsApp Inbox", icon: MessageCircle, path: "/whatsapp" },
  { label: "Financeiro", icon: DollarSign, path: "/financeiro" },
  { label: "Automação & IA", icon: Cpu, path: "/automacao" },
  { label: "Documentos", icon: FileText, path: "/documentos" },
  { label: "Configurações", icon: Settings, path: "/configuracoes" },
  { label: "Auditoria & Saúde", icon: Shield, path: "/auditoria" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const filtered = commands.filter(c =>
    c.label.toLowerCase().includes(search.toLowerCase())
  );

  const go = useCallback((path: string) => {
    navigate(path);
    setOpen(false);
    setSearch("");
  }, [navigate]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="glass p-0 max-w-lg border-border/50 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar módulo..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            autoFocus
          />
          <kbd className="text-[10px] font-medium text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">ESC</kbd>
        </div>
        <div className="max-h-64 overflow-y-auto py-2">
          {filtered.map(cmd => (
            <button
              key={cmd.path}
              onClick={() => go(cmd.path)}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-secondary-foreground hover:bg-secondary/50 transition-colors"
            >
              <cmd.icon className="h-4 w-4 text-muted-foreground" />
              <span>{cmd.label}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum resultado encontrado.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
