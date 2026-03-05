import { Card } from "@/components/ui/card";
import { MachineData } from "@/lib/api";
import { calculateMachineAnalytics, formatDuration } from "@/lib/analytics";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ShiftAnalyticsProps {
  data: MachineData[];
}

export function ShiftAnalytics({ data }: ShiftAnalyticsProps) {
  // Group data by shift
  const shiftData = {
    Morning: data.filter((d) => d.shift === "Morning"),
    Evening: data.filter((d) => d.shift === "Evening"),
    Night: data.filter((d) => d.shift === "Night"),
  };

  const chartData = Object.entries(shiftData).map(([shift, records]) => {
    const analytics = calculateMachineAnalytics(records);
    return {
      shift,
      running: Math.round(analytics.runningPercentage),
      downtime: Math.round(analytics.downtimePercentage),
      efficiency: Math.round(analytics.efficiencyPercentage),
    };
  });

  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold mb-2">Shift Performance Analysis</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Efficiency = Running / (Running + Downtime) — OFF time excluded
      </p>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="shift" stroke="hsl(var(--foreground))" />
          <YAxis stroke="hsl(var(--foreground))" />
          <Tooltip
            formatter={(value: any) => `${Math.round(value)}%`}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
          />
          <Legend />

          <Bar
            dataKey="efficiency"
            fill="hsl(var(--primary))"
            name="Efficiency %"
            radius={[8, 8, 0, 0]}
          />
          <Bar
            dataKey="running"
            fill="hsl(var(--running))"
            name="Running %"
            radius={[8, 8, 0, 0]}
          />
          <Bar
            dataKey="downtime"
            fill="hsl(var(--downtime))"
            name="Downtime %"
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {Object.entries(shiftData).map(([shift, records]) => {
          const analytics = calculateMachineAnalytics(records);
          return (
            <div
              key={shift}
              className="p-4 rounded-lg bg-secondary/50 space-y-2"
            >
              <h4 className="font-semibold text-sm">{shift} Shift</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Efficiency:</span>
                  <span className="font-bold text-primary">
                    {Math.round(analytics.efficiencyPercentage)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Running:</span>
                  <span className="font-medium text-success">
                    {formatDuration(analytics.runningTime)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Downtime:</span>
                  <span className="font-medium text-warning">
                    {formatDuration(analytics.downtimeTime)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Off:</span>
                  <span className="font-medium text-destructive">
                    {formatDuration(analytics.offTime)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
