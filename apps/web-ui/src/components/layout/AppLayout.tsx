import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Calendar,
  MessageCircle,
  DollarSign,
  Bot,
  FileText,
  Settings,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Clientes", href: "/leads-crm", icon: Users },
  { label: "Agenda", href: "/agenda", icon: Calendar },
  { label: "WhatsApp", href: "/whatsapp", icon: MessageCircle },
  { label: "Financeiro", href: "/financeiro", icon: DollarSign },
  { label: "Automação & IA", href: "/automacao", icon: Bot },
  { label: "Documentos", href: "/documentos", icon: FileText },
  { label: "Configurações", href: "/configuracoes", icon: Settings },
  { label: "Auditoria", href: "/auditoria", icon: Shield },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="w-64 border-r border-border/40 bg-sidebar/60 backdrop-blur-xl p-4 hidden lg:flex flex-col">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">L2</div>
            <div>
              <h1 className="text-sm font-bold text-foreground">CORE OS</h1>
              <p className="text-[10px] text-muted-foreground">Gestão Clínica · UI v2-clientes</p>
            </div>
          </div>
        </div>

        <nav className="space-y-1.5 flex-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all",
                  isActive
                    ? "bg-primary/12 text-primary border border-primary/20"
                    : "text-sidebar-foreground hover:bg-secondary/40 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 p-4 lg:p-6">{children}</main>
    </div>
  );
}
