import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "RUNNING" | "DOWNTIME" | "OFF" | "UNKNOWN";
  className?: string;
  showPulse?: boolean;
}

export function StatusBadge({
  status,
  className,
  showPulse = false,
}: StatusBadgeProps) {
  const getStatusStyles = () => {
    switch (status) {
      case "RUNNING":
        return "status-running";
      case "DOWNTIME":
        return "status-downtime";
      case "OFF":
        return "status-off";
      default:
        return "bg-muted text-muted-foreground border-muted";
    }
  };

  const getPulseClass = () => {
    if (!showPulse) return "";
    switch (status) {
      case "RUNNING":
        return "pulse-running";
      case "DOWNTIME":
        return "pulse-downtime";
      case "OFF":
        return "pulse-off";
      default:
        return "";
    }
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all",
        getStatusStyles(),
        getPulseClass(),
        className
      )}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
