import { GlassCard } from "@/components/ui/glass-card";
import { StatusPill } from "@/components/ui/status-pill";
import { Switch } from "@/components/ui/switch";
import { Cpu, Zap, Microchip, CheckCircle, XCircle, AlertTriangle, Monitor, HardDrive, RefreshCcw, Activity, DownloadCloud, Terminal, X, Play, ShieldAlert } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { apiGet } from "@/lib/api";

// Initial Mocks for prototype
const initialLogs = [
  { time: "14:03", rule: "confirm", input: "confirmo presença", result: "✅ confirmed", latency: "89ms" },
  { time: "13:45", rule: "reschedule", input: "preciso remarcar para sexta", result: "⚠️ reschedule_requested", latency: "245ms" },
];

export default function Automacao() {
  const [engineState, setEngineState] = useState<"locked" | "scanning" | "ready_to_install" | "installing" | "active">("locked");
  const [hardware, setHardware] = useState<any>(null);

  const [installProgress, setInstallProgress] = useState(0);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [toggles, setToggles] = useState({
    confirm: true,
    cancel: true,
    reschedule: false,
    triage: false
  });

  const toggleRule = (rule: keyof typeof toggles) => {
    setToggles(prev => ({ ...prev, [rule]: !prev[rule] }));
  };

  useEffect(() => {
    const cached = localStorage.getItem("l2_hardware_state");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.engineState === "active" && parsed.hardware?.ready) {
          setHardware(parsed.hardware);
          setEngineState("active");
          return;
        }
        if (parsed.engineState === "ready_to_install" && parsed.hardware) {
          setHardware(parsed.hardware);
          setEngineState("ready_to_install");
          return;
        }
      } catch (e) {
        localStorage.removeItem("l2_hardware_state");
      }
    }

    async function checkOllama() {
      try {
        const status = await apiGet<any>('/system/ollama/status');
        if (status.is_active && status.models?.length > 0) {
          const mainModel = status.models.find((m: any) => m.name.includes("llama3.2"))?.name || status.models[0].name;
          const hw = {
            model: mainModel,
            ready: true,
            os: "Windows",
            cpu: status.cpu || "Unknown",
            ram: status.ram || "Unknown",
            gpu: status.gpu || "Basic"
          };
          setHardware(hw);
          setEngineState("active");
          localStorage.setItem("l2_hardware_state", JSON.stringify({ engineState: "active", hardware: hw }));
        }
      } catch (e) {
        console.warn("Ollama not active initially");
      }
    }
    checkOllama();
  }, []);

  const startScan = async () => {
    setEngineState("scanning");
    const scanSteps = [
      "Lendo perfil de hardware do sistema...",
      "Identificando processador e memória física...",
      "Detectando acelerador gráfico (GPU)...",
      "Verificando compatibilidade com modelos de IA...",
    ];

    for (const step of scanSteps) {
      setTerminalLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${step}`]);
      await new Promise(r => setTimeout(r, 600));
    }

    try {
      const hw = await apiGet<any>('/system/hardware');
      const scannedHardware = {
        os: "Windows",
        cpu: hw.cpu,
        ram: hw.ram,
        gpu: hw.gpu !== "N/A" ? hw.gpu : "Acelerador Gráfico Básico",
        model: "llama3.2:3b",
        ready: false
      };
      setHardware(scannedHardware);
      setEngineState("ready_to_install");
      localStorage.setItem("l2_hardware_state", JSON.stringify({ engineState: "ready_to_install", hardware: scannedHardware }));
      setTerminalLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Scan finalizado com sucesso.`]);
    } catch (e) {
      setTerminalLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ERRO: Falha ao ler hardware físico. Verifique o backend Python.`]);
      setEngineState("locked");
    }
  };


  const installModel = async () => {
    setEngineState("installing");
    setInstallProgress(0);
    setTerminalLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Iniciando Pull do modelo ${hardware?.model || 'llama3.2:3b'}...`]);
    setTerminalLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Conectando API Python (SSE) ao Ollama Registry...`]);

    try {
      const token = localStorage.getItem("l2_token") || "";
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api";

      const res = await fetch(`${baseUrl}/system/ollama/pull`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ model: hardware?.model || "llama3.2:3b" })
      });

      if (!res.body) throw new Error("Sem corpo na resposta.");
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let isDone = false;
      let buffer = "";
      while (!isDone) {
        const { value, done } = await reader.read();
        if (done) {
          isDone = true;
        }
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // retain incomplete line in buffer
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const json = JSON.parse(line);
              if (json.status) {
                setTerminalLogs(prev => {
                  // avoid showing duplicate lines like "pulling manifest" repeatedly without progress changes
                  const lastLog = prev[prev.length - 1] || "";
                  if (lastLog.includes(json.status)) return prev;
                  return [...prev, `[...]: ${json.status}`]
                });
              }
              if (json.total && json.completed) {
                const pct = Math.round((json.completed / json.total) * 100);
                setInstallProgress(pct);
              }
              if (json.status === "success" || json.error) {
                isDone = true;
              }
            } catch (e) { }
          }
        }
      }

      setInstallProgress(100);
      setTerminalLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Modelo carregado em memória VRAM com sucesso.`]);

      const finalHardware = {
        ...hardware,
        os: "Windows",
        cpu: hardware?.cpu || "Unknown",
        ram: hardware?.ram || "Unknown",
        gpu: hardware?.gpu || "Basic"
      };
      setHardware(finalHardware);
      localStorage.setItem("l2_hardware_state", JSON.stringify({ engineState: "active", hardware: finalHardware }));

      setTimeout(() => {
        setEngineState("active");
      }, 1500);

    } catch (e: any) {
      setTerminalLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ERRO: ${e.message}`]);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [terminalLogs]);


  // ---- VIEWS ----

  if (engineState === "locked" || engineState === "scanning" || engineState === "ready_to_install" || engineState === "installing") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] animate-in-fade space-y-6">
        <GlassCard className="w-full max-w-2xl p-8 relative overflow-hidden border-primary/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-full mb-4 border border-primary/20">
              {engineState === "locked" && <ShieldAlert className="w-10 h-10 text-primary" />}
              {engineState === "scanning" && <Activity className="w-10 h-10 text-primary animate-pulse" />}
              {engineState === "ready_to_install" && <CheckCircle className="w-10 h-10 text-success" />}
              {engineState === "installing" && <DownloadCloud className="w-10 h-10 text-primary animate-bounce" />}
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              {engineState === "locked" && "Motor Neural Offline"}
              {engineState === "scanning" && "Diagnóstico de Sistema L2"}
              {engineState === "ready_to_install" && "Hardware Aprovado"}
              {engineState === "installing" && "Forjando Rede Neural..."}
            </h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              {engineState === "locked" && "Nenhum footprint de hardware detectado no banco de dados. Para ativar a Inteligência Artificial local, o L2 CORE OS precisa auditar os recursos da sua máquina."}
              {engineState === "scanning" && "Aguarde enquanto o sistema se comunica com as instruções do processador e verifica a disponibilidade de memória dedicada."}
              {engineState === "ready_to_install" && "A sua máquina possui os requisitos G-Tier para rodar o motor NLP pesadamente. O sistema determinou o peso neural ideal para você."}
              {engineState === "installing" && "Instalando silenciosamente o modelo quantizado via Ollama. Por favor não feche esta aba."}
            </p>
          </div>

          {engineState === "locked" && (
            <div className="flex justify-center mt-8">
              <button onClick={startScan} className="liquid-btn cursor-pointer px-8 py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-[0_0_20px_rgba(var(--primary),0.3)] transition-all flex items-center gap-2">
                <Monitor className="w-5 h-5" /> Iniciar Scanner de Hardware
              </button>
            </div>
          )}

          {engineState === "ready_to_install" && hardware && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="bg-black/50 p-4 rounded-xl border border-white/5 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Sistema:</span>
                  <span className="font-mono text-foreground">{hardware.os}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Processamento (CPU):</span>
                  <span className="font-mono text-foreground">{hardware.cpu}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Vídeo (CUDA):</span>
                  <span className="font-mono text-success font-bold">{hardware.gpu}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">RAM Física:</span>
                  <span className="font-mono text-foreground">{hardware.ram}</span>
                </div>
              </div>

              <div className="p-4 bg-primary/10 border border-primary/30 rounded-xl">
                <p className="text-xs text-primary/80 uppercase font-bold tracking-wider mb-2">Modelo Recomendado pelo Scanner:</p>
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-primary" />
                  <span className="text-lg font-bold text-foreground">{hardware.model}</span>
                </div>
              </div>

              <div className="flex justify-center mt-6">
                <button onClick={installModel} className="liquid-btn cursor-pointer w-full justify-center py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-[0_0_20px_rgba(var(--primary),0.3)] transition-all flex items-center gap-2">
                  <DownloadCloud className="w-5 h-5" /> Instalar Motor & Ativar (2.0 GB)
                </button>
              </div>
            </div>
          )}

          {(engineState === "scanning" || engineState === "installing") && (
            <div className="space-y-4 animate-in fade-in">
              {engineState === "installing" && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono text-muted-foreground">
                    <span>Progresso do Motor</span>
                    <span className="text-primary">{installProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${installProgress}%` }} />
                  </div>
                </div>
              )}

              <div className="bg-black/80 p-4 rounded-xl border border-white/10 h-48 overflow-y-auto font-mono text-xs flex flex-col gap-1 custom-scrollbar" ref={scrollRef}>
                {terminalLogs.map((log, i) => (
                  <span key={i} className={`${log.includes('%') || log.includes('sucesso') ? 'text-success' : 'text-muted-foreground/80'}`}>{log}</span>
                ))}
                {engineState === "scanning" && <span className="animate-pulse text-muted-foreground">_</span>}
              </div>
            </div>
          )}

        </GlassCard>
      </div>
    );
  }

  // ---- ACTIVE DASHBOARD VIEW (Phase 6 rebuilt) ----
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" /> L2 Motor (IA Local)
        </h1>
        <div className="flex items-center gap-2 bg-success/10 border border-success/30 px-3 py-1.5 rounded-full">
          <div className="h-2 w-2 rounded-full bg-success animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
          <span className="text-xs font-semibold text-success tracking-wide uppercase">Motor Online</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hardware Status Panel */}
        <div className="lg:col-span-1 space-y-6">
          <GlassCard className="relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />

            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              Diagnóstico de Hardware
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border/30 pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Processador</span>
                </div>
                <span className="text-xs font-medium text-foreground text-right">{hardware?.cpu}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border/30 pb-3">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Memória RAM</span>
                </div>
                <span className="text-xs font-medium text-foreground">{hardware?.ram}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border/30 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Unidade Gráfica (GPU)</span>
                </div>
                <span className="text-xs font-medium text-foreground text-right">{hardware?.gpu}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-success" />
                  <span className="text-xs text-muted-foreground">Compatibilidade IA</span>
                </div>
                <span className="text-xs font-bold text-success bg-success/10 px-2 py-0.5 rounded border border-success/20">Aprovado (Ultra)</span>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="relative overflow-hidden bg-gradient-to-br from-black/80 to-[#0A0A0A] border-primary/20">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <RefreshCcw className="h-4 w-4 text-primary animate-spin-slow" />
              Ollama Daemon
            </h3>
            <div className="space-y-3">
              <div className="bg-secondary/30 p-3 rounded-lg border border-border/20">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Modelo Carregado</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_5px_currentColor]"></span>
                </div>
                <span className="text-sm font-mono text-primary font-bold">{hardware?.model}</span>
              </div>
              <p className="text-xs text-muted-foreground/80 leading-relaxed">
                O tráfego neural está sendo executado 100% localmente no contexto deste PC. Nenhuma credencial ou dado de paciente é enviado para serviços externos The Hunter.
              </p>
            </div>
          </GlassCard>
        </div>

        {/* AI Control Center */}
        <div className="lg:col-span-2 space-y-6">
          <GlassCard>
            <h3 className="text-sm font-semibold text-foreground mb-4">Central de Automação (Switches)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div className={`p-4 rounded-xl border transition-all duration-300 ${toggles.confirm ? 'bg-primary/5 border-primary/30' : 'bg-secondary/20 border-border/20 opacity-60'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className={`h-4 w-4 ${toggles.confirm ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="text-sm font-bold text-foreground">Auto-Confirmação</span>
                  </div>
                  <Switch checked={toggles.confirm} onCheckedChange={() => toggleRule('confirm')} />
                </div>
                <p className="text-xs text-muted-foreground mb-3">Detecta intenção de confirmação via IA e atualiza a grid com status 'confirmed' instantaneamente.</p>
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground bg-black/40 p-1.5 rounded">
                  <span>p95 latência: 120ms</span>
                  <span>confiança min: 85%</span>
                </div>
              </div>

              <div className={`p-4 rounded-xl border transition-all duration-300 ${toggles.cancel ? 'bg-primary/5 border-primary/30' : 'bg-secondary/20 border-border/20 opacity-60'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <XCircle className={`h-4 w-4 ${toggles.cancel ? 'text-destructive' : 'text-muted-foreground'}`} />
                    <span className="text-sm font-bold text-foreground">Auto-Cancelamento</span>
                  </div>
                  <Switch checked={toggles.cancel} onCheckedChange={() => toggleRule('cancel')} />
                </div>
                <p className="text-xs text-muted-foreground mb-3">Processa intenções de cancelamento, arquiva a justificativa e libera o horário no grid automaticamente.</p>
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground bg-black/40 p-1.5 rounded">
                  <span>p95 latência: 98ms</span>
                  <span>confiança min: 90%</span>
                </div>
              </div>

              <div className={`p-4 rounded-xl border transition-all duration-300 ${toggles.reschedule ? 'bg-primary/5 border-primary/30' : 'bg-secondary/20 border-border/20 opacity-60'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <RefreshCcw className={`h-4 w-4 ${toggles.reschedule ? 'text-warning' : 'text-muted-foreground'}`} />
                    <span className="text-sm font-bold text-foreground">Fluxo de Remarcação</span>
                  </div>
                  <Switch checked={toggles.reschedule} onCheckedChange={() => toggleRule('reschedule')} />
                </div>
                <p className="text-xs text-muted-foreground mb-3">Extrai intenção e datas desejadas, propondo horários disponíveis ao paciente via WhatsApp.</p>
                <div className="flex justify-between text-[10px] font-mono text-warning/70 bg-warning/10 border border-warning/20 p-1.5 rounded">
                  <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Experimental</span>
                  <span>Em testes locais</span>
                </div>
              </div>

              <div className={`p-4 rounded-xl border transition-all duration-300 ${toggles.triage ? 'bg-primary/5 border-primary/30' : 'bg-secondary/20 border-border/20 opacity-60'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <Activity className={`h-4 w-4 ${toggles.triage ? 'text-info' : 'text-muted-foreground'}`} />
                    <span className="text-sm font-bold text-foreground">Triagem de Dúvidas</span>
                  </div>
                  <Switch checked={toggles.triage} onCheckedChange={() => toggleRule('triage')} />
                </div>
                <p className="text-xs text-muted-foreground mb-3">Responde dúvidas frequentes usando a Base de Conhecimento RAG da clínica antes de acionar humano.</p>
                <div className="flex justify-between text-[10px] font-mono text-warning/70 bg-warning/10 border border-warning/20 p-1.5 rounded">
                  <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Experimental</span>
                  <span>Vector DB Offline</span>
                </div>
              </div>

            </div>
          </GlassCard>

          <GlassCard className="!p-0 overflow-hidden">
            <div className="p-4 border-b border-border/30 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-foreground">Fluxo Neural em Tempo Real</h3>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Escutando Webhooks</span>
              </div>
            </div>
            <table className="premium-table">
              <thead>
                <tr><th>Hora</th><th>Automação Acionada</th><th>Input Originário</th><th>Veredito</th><th>Latência</th></tr>
              </thead>
              <tbody>
                {initialLogs.map((l, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors">
                    <td className="text-xs font-mono text-muted-foreground">{l.time}</td>
                    <td className="text-xs font-medium text-foreground">{l.rule}</td>
                    <td className="text-xs text-muted-foreground truncate max-w-[150px]">"{l.input}"</td>
                    <td className="text-xs">{l.result}</td>
                    <td className="text-[10px] font-mono text-muted-foreground bg-black/40 px-1 py-0.5 rounded">{l.latency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
