import { GlassCard } from "@/components/ui/glass-card";
import { Settings, Shield, MessageCircle, Cpu, Smartphone, Link, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { apiGet, apiPost, getAuthToken, setAuthToken, waGet, waPost } from "@/lib/api";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/async-state";

const tabs = [
  { id: "geral", label: "Geral", icon: Settings },
  { id: "seguranca", label: "Segurança", icon: Shield },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "ia", label: "IA", icon: Cpu },
  { id: "mobile", label: "Mobile Sync", icon: Smartphone },
  { id: "integracoes", label: "Integrações", icon: Link },
];

export default function Configuracoes() {
  const [activeTab, setActiveTab] = useState("geral");
  const [token, setToken] = useState(getAuthToken());
  const [cfgJson, setCfgJson] = useState('{"settings":{"MOBILE_SYNC_POLL_SECONDS":30}}');
  const [output, setOutput] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingSync, setPendingSync] = useState(0);
  const [waMode, setWaMode] = useState<"primary" | "dedicated">("primary");
  const [autoFinanceMode, setAutoFinanceMode] = useState<"confirm_required" | "auto_if_high_confidence">("confirm_required");

  useEffect(() => {
    setAuthToken(token.trim());
  }, [token]);

  async function genOwnerToken() {
    setError(null); setIsLoading(true);
    try {
      const r = await apiPost<any>("/auth/dev-token?role=owner");
      setToken(r.token || "");
      setOutput(r);
    } catch (e: any) {
      setError(String(e.message || e));
      setOutput({ error: String(e.message || e) });
    } finally { setIsLoading(false); }
  }

  async function loadCurrent() {
    setError(null); setIsLoading(true);
    try {
      const r = await apiGet<any>("/config/current");
      setOutput(r);
      const m = r?.overrides?.whatsapp_number_mode || r?.whatsapp_policy?.number_mode;
      if (m === "dedicated" || m === "primary") setWaMode(m);
      const fm = r?.overrides?.auto_finance_from_whatsapp || r?.whatsapp_policy?.auto_finance_from_whatsapp;
      if (fm === "confirm_required" || fm === "auto_if_high_confidence") setAutoFinanceMode(fm);
    } catch (e: any) {
      setError(String(e.message || e));
      setOutput({ error: String(e.message || e) });
    } finally { setIsLoading(false); }
  }

  async function validateApply(apply = false) {
    setError(null); setIsLoading(true);
    if (apply) setPendingSync((v) => v + 1); // optimistic marker
    try {
      const body = JSON.parse(cfgJson);
      const r = await apiPost<any>(apply ? "/config/apply" : "/config/validate", body);
      setOutput(r);
    } catch (e: any) {
      setError(String(e.message || e));
      setOutput({ error: String(e.message || e) });
    } finally {
      if (apply) setPendingSync((v) => Math.max(0, v - 1));
      setIsLoading(false);
    }
  }

  async function saveWhatsAppPolicy() {
    setError(null); setIsLoading(true); setPendingSync((v) => v + 1);
    try {
      const payload = {
        settings: {
          whatsapp_number_mode: waMode,
          auto_mark_read: false,
          auto_reply_only_safe_intents: true,
          human_review_default: true,
          auto_finance_from_whatsapp: autoFinanceMode,
        },
      };
      const r = await apiPost<any>("/config/apply", payload);
      setOutput(r);
    } catch (e: any) {
      setError(String(e.message || e));
      setOutput({ error: String(e.message || e) });
    } finally {
      setPendingSync((v) => Math.max(0, v - 1));
      setIsLoading(false);
    }
  }

  async function wa(action: "status" | "connect" | "disconnect" | "catchup") {
    setError(null); setIsLoading(true);
    try {
      const r = action === "status"
        ? await waGet<any>("/session/status")
        : action === "connect"
          ? await waPost<any>("/session/connect")
          : action === "catchup"
            ? await waPost<any>("/session/catchup")
            : await waPost<any>("/session/disconnect", { clearAuth: false });
      setOutput(r);
    } catch (e: any) {
      setError(String(e.message || e));
      setOutput({ error: String(e.message || e) });
    } finally { setIsLoading(false); }
  }

  return (
    <div className="space-y-6 animate-in-fade">
      <h1 className="text-lg font-bold text-foreground">Configurações</h1>
      {pendingSync > 0 && <LoadingState label={`Sincronizando alterações (${pendingSync})...`} />}
      {isLoading && <LoadingState label="Processando ação..." />}
      {error && <ErrorState message={error} onRetry={() => setError(null)} />}

      <div className="flex gap-6">
        <div className="w-48 flex-shrink-0 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <GlassCard className="flex-1 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">Token</label>
            <div className="flex gap-2 mt-1">
              <input value={token} onChange={(e) => setToken(e.target.value)} className="w-full bg-secondary/50 rounded-xl px-3 py-2 text-sm" placeholder="Bearer token" />
              <button onClick={genOwnerToken} className="liquid-btn text-xs">Gerar owner</button>
            </div>
          </div>

          {activeTab === "geral" && (
            <>
              <div>
                <label className="text-xs text-muted-foreground">Config JSON</label>
                <textarea value={cfgJson} onChange={(e) => setCfgJson(e.target.value)} className="w-full mt-1 h-32 bg-secondary/50 rounded-xl px-3 py-2 text-xs" />
              </div>
              <div className="flex gap-2">
                <button onClick={loadCurrent} className="liquid-btn text-xs">Carregar atual</button>
                <button onClick={() => validateApply(false)} className="liquid-btn text-xs">Validar</button>
                <button onClick={() => validateApply(true)} className="liquid-btn liquid-btn-primary text-xs flex items-center gap-2"><Save className="h-3.5 w-3.5"/>Aplicar</button>
              </div>
            </>
          )}

          {activeTab === "whatsapp" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Esse número de WhatsApp é dedicado ao atendimento?</label>
                <select value={waMode} onChange={(e) => setWaMode(e.target.value as any)} className="w-full mt-1 bg-secondary/50 rounded-xl px-3 py-2 text-sm">
                  <option value="primary">Número principal (modo seguro)</option>
                  <option value="dedicated">Número dedicado ao atendimento</option>
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  No modo principal, o sistema prioriza revisão humana e automação conservadora para evitar ruído no WhatsApp pessoal da clínica.
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Lançamentos financeiros via WhatsApp</label>
                <select value={autoFinanceMode} onChange={(e) => setAutoFinanceMode(e.target.value as any)} className="w-full mt-1 bg-secondary/50 rounded-xl px-3 py-2 text-sm">
                  <option value="confirm_required">Exigir confirmação humana (recomendado)</option>
                  <option value="auto_if_high_confidence">Automático em alta confiança</option>
                </select>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={saveWhatsAppPolicy} className="liquid-btn liquid-btn-primary text-xs">Salvar política</button>
                <button onClick={() => wa("status")} className="liquid-btn text-xs">Status</button>
                <button onClick={() => wa("connect")} className="liquid-btn text-xs">Conectar</button>
                <button onClick={() => wa("catchup")} className="liquid-btn text-xs">Catch-up</button>
                <button onClick={() => wa("disconnect")} className="liquid-btn text-xs">Desconectar</button>
              </div>
            </div>
          )}

          {activeTab !== "geral" && activeTab !== "whatsapp" && (
            <div className="text-sm text-muted-foreground">Módulo em integração com backend.</div>
          )}

          {output ? (
            <pre className="bg-secondary/30 rounded-xl p-3 text-xs overflow-auto max-h-64">{JSON.stringify(output, null, 2)}</pre>
          ) : (
            <EmptyState title="Nenhuma ação executada ainda." />
          )}
        </GlassCard>
      </div>
    </div>
  );
}
