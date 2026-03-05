import {
  LayoutDashboard, Users, Calendar, MessageCircle, DollarSign,
  Cpu, FileText, Settings, Shield
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";

const modules = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Leads & CRM", url: "/leads", icon: Users },
  { title: "Agenda", url: "/agenda", icon: Calendar },
  { title: "WhatsApp", url: "/whatsapp", icon: MessageCircle },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Automação & IA", url: "/automacao", icon: Cpu },
  { title: "Documentos", url: "/documentos", icon: FileText },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
  { title: "Auditoria", url: "/auditoria", icon: Shield },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <div className={`p-4 ${collapsed ? "px-2" : ""}`}>
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-primary font-bold text-sm">L2</span>
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-sm font-bold text-foreground tracking-tight">CORE OS</h1>
              <p className="text-[10px] text-muted-foreground">Gestão Clínica</p>
            </div>
          )}
        </div>
      </div>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {modules.map((item) => {
                const isActive = item.url === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.url);

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`}
                        activeClassName=""
                      >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
