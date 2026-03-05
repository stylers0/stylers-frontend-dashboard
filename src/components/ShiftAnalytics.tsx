import { Card } from "@/components/ui/card";
import { MachineData } from "@/lib/api";
import {
  calculateMachineAnalytics,
  calculateShiftAwareAnalytics,
  formatDuration,
} from "@/lib/analytics";
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
  /**
   * Pass the active time filter so ShiftAnalytics knows when to apply
   * shift-boundary splitting. Splitting is ONLY applied for "shift" filter
   * because that's the only view where a single record can meaningfully
   * straddle a shift boundary within the visible window.
   * For day/week/month/3months the old behaviour (group by record.shift)
   * is kept — splitting across many days would produce confusing numbers.
   */
  timeFilter?: "shift" | "day" | "week" | "month" | "3months";
}

export function ShiftAnalytics({
  data,
  timeFilter = "shift",
}: ShiftAnalyticsProps) {
  // ── Shift-aware mode (only for "Current Shift" filter) ──────────────────
  //
  // Instead of bucketing records by their stored `shift` field, we walk each
  // record's real wall-clock time and split its duration at the 07:00 / 15:00
  // / 23:00 PKT boundaries. This means a record that started at 14:00 PKT with
  // a 2-hour duration correctly contributes 1h to Morning and 1h to Evening.
  //
  // For all other filters we fall back to the simple group-by-shift approach
  // (faster, and boundary splits across multi-day ranges are rarely meaningful).

  const useShiftSplitting = timeFilter === "shift";

  const shiftAware = useShiftSplitting
    ? calculateShiftAwareAnalytics(data)
    : null;

  // ── Fallback: simple group-by-shift (used for non-shift filters) ─────────
  const shiftGroups = !useShiftSplitting
    ? {
        Morning: data.filter((d) => d.shift === "Morning"),
        Evening: data.filter((d) => d.shift === "Evening"),
        Night: data.filter((d) => d.shift === "Night"),
      }
    : null;

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartData = (["Morning", "Evening", "Night"] as const).map((shift) => {
    if (useShiftSplitting && shiftAware) {
      const s = shiftAware[shift];
      return {
        shift,
        running: Math.round(s.runningPercentage),
        downtime: Math.round(s.downtimePercentage),
        efficiency: Math.round(s.efficiencyPercentage),
      };
    } else {
      const records = shiftGroups![shift];
      const analytics = calculateMachineAnalytics(records);
      return {
        shift,
        running: Math.round(analytics.runningPercentage),
        downtime: Math.round(analytics.downtimePercentage),
        efficiency: Math.round(analytics.efficiencyPercentage),
      };
    }
  });

  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold mb-2">Shift Performance Analysis</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Efficiency = Running / (Running + Downtime) — OFF time excluded
        {useShiftSplitting && (
          <span className="ml-2 text-primary font-medium">
            · Durations split at shift boundaries (07:00 / 15:00 / 23:00 PKT)
          </span>
        )}
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
        {(["Morning", "Evening", "Night"] as const).map((shift) => {
          let runningTime: number;
          let downtimeTime: number;
          let offTime: number;
          let efficiencyPercentage: number;

          if (useShiftSplitting && shiftAware) {
            const s = shiftAware[shift];
            runningTime = s.runningTime;
            downtimeTime = s.downtimeTime;
            offTime = s.offTime;
            efficiencyPercentage = s.efficiencyPercentage;
          } else {
            const analytics = calculateMachineAnalytics(shiftGroups![shift]);
            runningTime = analytics.runningTime;
            downtimeTime = analytics.downtimeTime;
            offTime = analytics.offTime;
            efficiencyPercentage = analytics.efficiencyPercentage;
          }

          return (
            <div
              key={shift}
              className="p-4 rounded-lg bg-secondary/50 space-y-2">
              <h4 className="font-semibold text-sm">{shift} Shift</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Efficiency:</span>
                  <span className="font-bold text-primary">
                    {Math.round(efficiencyPercentage)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Running:</span>
                  <span className="font-medium text-success">
                    {formatDuration(runningTime)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Downtime:</span>
                  <span className="font-medium text-warning">
                    {formatDuration(downtimeTime)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Off:</span>
                  <span className="font-medium text-destructive">
                    {formatDuration(offTime)}
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
