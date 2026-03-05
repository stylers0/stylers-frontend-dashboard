import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface UtilizationGaugeProps {
  value: number;
  title: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg";
}

export function UtilizationGauge({
  value,
  title,
  subtitle,
  size = "md",
}: UtilizationGaugeProps) {
  // Ensure value is a valid number and clamp between 0-100
  const normalizedValue = Math.min(100, Math.max(0, isNaN(value) ? 0 : value));
  const displayValue = Math.round(normalizedValue);
  
  const sizeClasses = {
    sm: "w-32 h-32",
    md: "w-40 h-40",
    lg: "w-48 h-48",
  };

  const getColor = () => {
    if (normalizedValue >= 80) return "text-success";
    if (normalizedValue >= 50) return "text-warning";
    return "text-destructive";
  };

  return (
    <Card className="p-6 flex flex-col items-center">
      <div className="relative inline-flex items-center justify-center">
        <svg
          className={cn(sizeClasses[size], "transform -rotate-90")}
          viewBox="0 0 100 100"
        >
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted opacity-20"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            className={getColor()}
            strokeDasharray={`${(normalizedValue / 100) * 251.2} 251.2`}
            style={{
              transition: "stroke-dasharray 0.5s ease",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-3xl font-bold", getColor())}>
            {displayValue}%
          </span>
        </div>
      </div>
      <div className="mt-4 text-center">
        <h4 className="font-semibold text-foreground">{title}</h4>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
    </Card>
  );
}
