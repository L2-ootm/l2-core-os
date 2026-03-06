import { Wifi, WifiOff, Activity } from "lucide-react";

type ConnStatus = "online" | "offline" | "degraded";

export function ConnectivityIndicator({ status = "online" }: { status?: ConnStatus }) {
  const config = {
    online: { icon: Wifi, label: "Online", class: "text-success" },
    offline: { icon: WifiOff, label: "Offline", class: "text-destructive" },
    degraded: { icon: Activity, label: "Degradado", class: "text-warning" },
  }[status];

  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${config.class}`}>
      <Icon className="h-3.5 w-3.5" />
      <span>{config.label}</span>
    </div>
  );
}
