import { Loader2, Check, AlertTriangle, X } from "lucide-react";

type SyncStatus = "idle" | "pending" | "confirmed" | "failed" | "retrying";

interface SyncBadgeProps {
  status: SyncStatus;
}

export function SyncBadge({ status }: SyncBadgeProps) {
  if (status === "idle") return null;

  const config = {
    pending: { class: "sync-pending", icon: Loader2, label: "Sincronizando...", animate: true },
    confirmed: { class: "sync-confirmed", icon: Check, label: "Salvo", animate: false },
    failed: { class: "sync-failed", icon: X, label: "Falha", animate: false },
    retrying: { class: "sync-pending", icon: Loader2, label: "Tentando novamente...", animate: true },
  }[status];

  const Icon = config.icon;

  return (
    <span className={config.class}>
      <Icon className={`h-3 w-3 ${config.animate ? "animate-spin" : ""}`} />
      {config.label}
    </span>
  );
}
