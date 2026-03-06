import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import LeadsCRM from "./pages/LeadsCRM";
import Agenda from "./pages/Agenda";
import WhatsAppInbox from "./pages/WhatsAppInbox";
import Financeiro from "./pages/Financeiro";
import Automacao from "./pages/Automacao";
import Documentos from "./pages/Documentos";
import Configuracoes from "./pages/Configuracoes";
import Auditoria from "./pages/Auditoria";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/leads-crm" element={<LeadsCRM />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/whatsapp" element={<WhatsAppInbox />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/automacao" element={<Automacao />} />
            <Route path="/documentos" element={<Documentos />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="/auditoria" element={<Auditoria />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
