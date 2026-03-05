import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { CommandPalette } from "@/components/ui/command-palette";
import { ReactNode } from "react";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
      <CommandPalette />
    </SidebarProvider>
  );
}
