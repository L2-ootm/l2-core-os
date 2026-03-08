import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { ReactElement, isValidElement } from "react";

interface KPICardProps {
  label?: string;
  title?: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  trend?: "up" | "down";
  icon?: LucideIcon | ReactElement;
  iconColor?: string;
}

export function KPICard({ label, title, value, change, changeType = "neutral", trend, icon, iconColor }: KPICardProps) {
  const displayLabel = label || title || "";
  let displayChangeType = changeType;
  if (trend === "up") displayChangeType = "positive";
  if (trend === "down") displayChangeType = "negative";
  
  // Check if icon is a React element or a component
  const renderIcon = () => {
    if (!icon) return null;
    
    // If it's already a React element (JSX), render it directly
    if (isValidElement(icon)) {
      return <div className={cn("p-2 rounded-xl", iconColor || "bg-primary/10")}>{icon}</div>;
    }
    
    // If it's a Lucide icon component (function), invoke it
    if (typeof icon === 'function') {
      const IconComponent = icon as LucideIcon;
      return (
        <div className={cn("p-2 rounded-xl", iconColor || "bg-primary/10")}>
          <IconComponent className="h-4 w-4 text-primary" />
        </div>
      );
    }
    
    return null;
  };
  
  return (
    <div className="kpi-card group">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{displayLabel}</span>
        {renderIcon()}
      </div>
      <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
      {change && (
        <p className={cn(
          "text-xs mt-1.5 font-medium",
          displayChangeType === "positive" && "text-success",
          displayChangeType === "negative" && "text-destructive",
          displayChangeType === "neutral" && "text-muted-foreground"
        )}>
          {change}
        </p>
      )}
    </div>
  );
}
