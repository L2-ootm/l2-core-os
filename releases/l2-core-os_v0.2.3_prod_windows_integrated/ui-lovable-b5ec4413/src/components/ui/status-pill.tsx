import { cn } from "@/lib/utils";

const statusConfig: Record<string, { class: string; label: string }> = {
  scheduled: { class: "status-scheduled", label: "Agendado" },
  confirmed: { class: "status-confirmed", label: "Confirmado" },
  canceled: { class: "status-canceled", label: "Cancelado" },
  no_show: { class: "status-no-show", label: "No-show" },
  completed: { class: "status-confirmed", label: "Concluído" },
  reschedule_requested: { class: "status-no-show", label: "Remarcação" },
  new_lead: { class: "status-scheduled", label: "Novo Lead" },
  known_client: { class: "status-confirmed", label: "Cliente" },
  unknown: { class: "status-no-show", label: "Desconhecido" },
  human_review: { class: "status-canceled", label: "Revisão Humana" },
  pending: { class: "status-no-show", label: "Pendente" },
  paid: { class: "status-confirmed", label: "Pago" },
  overdue: { class: "status-canceled", label: "Vencido" },
};

interface StatusPillProps {
  status: string;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  const config = statusConfig[status] || { class: "", label: status };
  return (
    <span className={cn("status-pill", config.class, className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
}
