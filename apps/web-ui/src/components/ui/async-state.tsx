import { ReactNode } from "react";

export function LoadingState({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/20 p-4 text-sm text-muted-foreground animate-pulse">
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
      <div>{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 liquid-btn text-xs">Tentar novamente</button>
      )}
    </div>
  );
}

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/20 p-6 text-center text-sm text-muted-foreground">
      <p>{title}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
