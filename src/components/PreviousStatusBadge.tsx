import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "RUNNING" | "DOWNTIME" | "OFF" | "UNKNOWN";
  className?: string;
  showPulse?: boolean;
}

export function PreviousStatusBadge({
  status,
  className,
  showPulse = false,
}: StatusBadgeProps) {
  const getStatusColor = () => {
    switch (status) {
      case "RUNNING":
        return "text-green-600 font-semibold";
      case "DOWNTIME":
        return "text-yellow-600 font-semibold";
      case "OFF":
        return "text-red-600 font-semibold";
      default:
        return "text-gray-600 font-semibold";
    }
  };

  return (
    <span
      className={cn(
        "inline-block text-xs border-b border-transparent hover:border-current transition-all",
        getStatusColor(),
        showPulse ? "animate-pulse" : "",
        className
      )}>
      {status}
    </span>
  );
}
