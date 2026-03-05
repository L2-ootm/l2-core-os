import { SidebarTrigger } from "@/components/ui/sidebar";
import { ConnectivityIndicator } from "@/components/ui/connectivity-indicator";
import { Bell, Search } from "lucide-react";
import { useLocation } from "react-router-dom";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/leads": "Leads & CRM",
  "/agenda": "Agenda & Atendimentos",
  "/whatsapp": "WhatsApp Inbox",
  "/financeiro": "Financeiro",
  "/automacao": "Automação & IA",
  "/documentos": "Documentos",
  "/configuracoes": "Configurações",
  "/auditoria": "Auditoria & Saúde",
};

export function TopBar() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || "L2 CORE OS";

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-border/50 glass-subtle flex-shrink-0">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
        <div className="h-5 w-px bg-border/50" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>

      <div className="flex items-center gap-4">
        <ConnectivityIndicator status="online" />

        <button className="liquid-btn-ghost p-2 rounded-xl" title="Buscar (Ctrl+K)">
          <Search className="h-4 w-4" />
        </button>

        <button className="liquid-btn-ghost p-2 rounded-xl relative" title="Notificações">
          <Bell className="h-4 w-4" />
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary pulse-glow" />
        </button>

        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
          DR
        </div>
      </div>
    </header>
  );
}
