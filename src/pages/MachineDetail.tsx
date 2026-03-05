import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchMachineData, exportToCSV } from "@/lib/api";
import { getWebSocketClient } from "@/lib/websocket";
import {
  calculateMachineAnalytics,
  formatDuration,
  getDateRangeForFilter,
} from "@/lib/analytics";
import { StatusBadge } from "@/components/StatusBadge";
import { StatsCard } from "@/components/StatsCard";
import { StatusTimelineHorizontal } from "@/components/StatusTimelineHorizontal";
import { FilterBar } from "@/components/FilterBar";
import { DataTable } from "@/components/DataTable";
import { UtilizationGauge } from "@/components/UtilizationGauge";
import { ShiftAnalytics } from "@/components/ShiftAnalytics";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Activity,
  TrendingUp,
  Power,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toLocalISOString } from "@/components/toLocalISOString";
import { parsePKTTimestamp, formatDisplayDateTime } from "@/lib/timeUtils";
import { StatusTimeline } from "@/components/StatusTimeline";

export default function MachineDetail() {
  const { machineName } = useParams<{ machineName: string }>();
  const [showResetButton, setShowResetButton] = useState(false);

  const [timeFilter, setTimeFilter] = useState<
    "shift" | "day" | "week" | "month" | "3months"
  >("shift");
  const [liveStatus, setLiveStatus] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "RUNNING" | "DOWNTIME" | "OFF"
  >("ALL");

  const [stopsModalOpen, setStopsModalOpen] = useState(false);
  const [stopsList, setStopsList] = useState<string[]>([]);

  const [customDateRange, setCustomDateRange] = useState<{
    from: string;
    to: string;
  } | null>(null);

  // FIXED: Memoize dateRange to prevent infinite refetch loop
  const dateRange = useMemo(() => {
    if (customDateRange) return customDateRange;
    return getDateRangeForFilter(timeFilter);
  }, [customDateRange, timeFilter]);

  const formatDateRangeForDisplay = (from: string, to: string) => {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    // Check if it's a single day
    if (fromDate.toDateString() === toDate.toDateString()) {
      return fromDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }

    // Format as range
    return `${fromDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })} - ${toDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  };

  const handleResetAllFilters = () => {
    setTimeFilter("shift");
    setCustomDateRange(null);
    setStatusFilter("ALL");
    setShowResetButton(false);
    toast.success("All filters have been reset");
  };

  // Create current filters object for display
  const currentFilters = useMemo(() => {
    const timeRangeMap = {
      shift: "Current Shift",
      day: "Last 24 Hours",
      week: "Last Week",
      month: "Last Month",
      "3months": "Last 3 Months",
    };

    const filters: any = {
      timeRange: timeRangeMap[timeFilter] || timeFilter,
    };

    if (customDateRange) {
      filters.customDate = formatDateRangeForDisplay(
        customDateRange.from,
        customDateRange.to,
      );
    }

    // Show reset button if any non-default filters are active
    const hasActiveFilters = timeFilter !== "shift" || customDateRange !== null;

    setShowResetButton(hasActiveFilters);

    return filters;
  }, [timeFilter, customDateRange]);

  const {
    data: machineData = [],
    refetch,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["machine-data", machineName, dateRange.from, dateRange.to],
    queryFn: () =>
      fetchMachineData({
        machine: machineName,
        from: dateRange.from,
        to: dateRange.to,
        limit: 99999,
      }),
    enabled: !!machineName && !!dateRange.from && !!dateRange.to,
    refetchInterval: 60000,
    staleTime: 10000,
  });

  // WebSocket for live updates
  useEffect(() => {
    if (!machineName) return;

    const ws = getWebSocketClient();
    const unsubscribe = ws.subscribe((message) => {
      if (
        message.machine === machineName &&
        (message.type === "machine_update" ||
          message.type === "live_status_update")
      ) {
        setLiveStatus(message);
        refetch();
        toast.success(`${machineName} updated: ${message.status}`);
      }
    });

    return () => unsubscribe();
  }, [machineName, refetch]);

  const analytics = calculateMachineAnalytics(machineData);

  // Export handler
  const handleExport = async () => {
    if (!machineName) return;
    try {
      const blob = await exportToCSV({
        machine: machineName,
        from: dateRange.from,
        to: dateRange.to,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${machineName}-report-${
        new Date().toISOString().split("T")[0]
      }.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Report exported successfully!");
    } catch (error) {
      toast.error("Failed to export report");
    }
  };

  const latestRecord = machineData[0];
  const currentStatus = liveStatus?.status || latestRecord?.status || "UNKNOWN";

  const chartData = [
    {
      name: machineName || "Machine",
      running: Math.round(analytics.runningPercentage),
      downtime: Math.round(analytics.downtimePercentage),
      off: Math.round(analytics.offPercentage),
    },
  ];

  // Get stops list for modal - using PKT timestamp parser
  const getStopsList = () => {
    return machineData
      .filter((d) => d.status === "OFF")
      .map((d) => {
        // Parse PKT timestamp from API (already in PKT, not UTC)
        const date = parsePKTTimestamp(d.timestamp);
        return formatDisplayDateTime(date);
      });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <Link to="/">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-bold text-foreground">
                {machineName}
              </h1>
              {/* <StatusBadge status={currentStatus as any} showPulse /> */}
              {isFetching && (
                <span className="text-sm text-muted-foreground animate-pulse">
                  Updating...
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              Comprehensive analytics and real-time monitoring
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <FilterBar
          timeFilter={timeFilter}
          onTimeFilterChange={(value) => {
            setTimeFilter(value);
            setCustomDateRange(null);
          }}
          onCustomDateChange={(from, to) => {
            if (from && to) {
              setCustomDateRange({
                from: toLocalISOString(from),
                to: toLocalISOString(to),
              });
            } else {
              setCustomDateRange(null);
            }
          }}
          onExport={handleExport}
          onRefresh={() => {
            refetch();
            toast.success("Data refreshed");
          }}
          onResetFilters={handleResetAllFilters} // Add this
          showResetButton={showResetButton} // Add this
          currentFilters={currentFilters} // Add this
        />

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="data">Data Log</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                title="Longest Run"
                value={formatDuration(analytics.longestRunDuration)}
                icon={TrendingUp}
                subtitle="Continuous operation"
              />
              <StatsCard
                title="Total Downtime"
                value={formatDuration(analytics.downtimeTime)}
                icon={AlertTriangle}
                subtitle="Time spent in downtime"
                className="border-warning/20"
              />
              <div
                onClick={() => {
                  const stops = getStopsList();
                  setStopsList(stops);
                  setStopsModalOpen(true);
                }}
                className="cursor-pointer">
                <StatsCard
                  title="Number of Stops"
                  value={analytics.numberOfOffs}
                  icon={Power}
                  subtitle="Click to view times"
                  className="border-destructive/20 hover:border-destructive/50"
                />
              </div>
              <StatsCard
                title="Total Records"
                value={analytics.totalRecords}
                icon={Activity}
                subtitle="Data points"
              />
            </div>

            {/* Efficiency Card */}
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-2">Machine Efficiency</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Efficiency = Running / (Running + Downtime) — OFF time excluded
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <UtilizationGauge
                  value={analytics.efficiencyPercentage || 0}
                  title="Efficiency"
                  subtitle="Running vs Downtime"
                />
                <UtilizationGauge
                  value={analytics.runningPercentage || 0}
                  title="Running %"
                  subtitle="Of total time"
                />
                <UtilizationGauge
                  value={analytics.downtimePercentage || 0}
                  title="Downtime %"
                  subtitle="Of total time"
                />
              </div>
            </Card>

            {/* Status Timeline - Horizontal scrollable */}
            <StatusTimeline
              data={machineData}
              title="Status Distribution Timeline"
              machineName={machineName}
            />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {/* Shift Analytics */}
            <ShiftAnalytics data={machineData} />

            {/* Advanced Analytics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Running Statistics */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-5 h-5 text-success" />
                  <h3 className="text-lg font-bold">Running Statistics</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Total Running Time
                    </span>
                    <span className="text-2xl font-bold text-success">
                      {formatDuration(analytics.runningTime)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Percentage</span>
                    <span className="text-xl font-bold text-success">
                      {Math.round(analytics.runningPercentage)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Longest Continuous Run
                    </span>
                    <span className="text-xl font-bold text-success">
                      {formatDuration(analytics.longestRunDuration)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Running Records
                    </span>
                    <span className="text-xl font-bold">
                      {analytics.statusCounts.RUNNING}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Downtime Statistics */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                  <h3 className="text-lg font-bold">Downtime Statistics</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Total Downtime
                    </span>
                    <span className="text-2xl font-bold text-warning">
                      {formatDuration(analytics.downtimeTime)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Percentage</span>
                    <span className="text-xl font-bold text-warning">
                      {Math.round(analytics.downtimePercentage)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Average Duration
                    </span>
                    <span className="text-xl font-bold text-warning">
                      {formatDuration(analytics.averageDowntimeDuration)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Downtime Events
                    </span>
                    <span className="text-xl font-bold">
                      {analytics.statusCounts.DOWNTIME}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Off Statistics */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Power className="w-5 h-5 text-destructive" />
                  <h3 className="text-lg font-bold">Off Time Statistics</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Total Off Time
                    </span>
                    <span className="text-2xl font-bold text-destructive">
                      {formatDuration(analytics.offTime)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Percentage</span>
                    <span className="text-xl font-bold text-destructive">
                      {Math.round(analytics.offPercentage)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Average Duration
                    </span>
                    <span className="text-xl font-bold text-destructive">
                      {formatDuration(analytics.averageOffDuration)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Number of Stops
                    </span>
                    <span className="text-xl font-bold">
                      {analytics.numberOfOffs}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Efficiency Card */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-bold">Efficiency Analysis</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Efficiency</span>
                    <span className="text-2xl font-bold text-primary">
                      {Math.round(analytics.efficiencyPercentage)}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Running / (Running + Downtime) — OFF excluded
                  </p>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-muted-foreground">Active Time</span>
                    <span className="text-xl font-bold">
                      {formatDuration(
                        analytics.runningTime + analytics.downtimeTime,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Records</span>
                    <span className="text-xl font-bold">
                      {analytics.totalRecords}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Data Log Tab */}
          <TabsContent value="data" className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <span className="font-medium text-sm">Filter by Status:</span>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as any)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="RUNNING">Running</SelectItem>
                  <SelectItem value="DOWNTIME">Downtime</SelectItem>
                  <SelectItem value="OFF">Off</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DataTable
              statusFilter={statusFilter}
              data={machineData}
              title={`${machineName} Data Log`}
              maxRows={1000}
              isLoading={isFetching}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Stops Modal */}
      <Dialog open={stopsModalOpen} onOpenChange={setStopsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-destructive">
              OFF Events ({stopsList.length})
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {stopsList.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No OFF events in the selected time range
              </p>
            ) : (
              <ul className="space-y-2">
                {stopsList.map((time, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-foreground p-2 rounded bg-secondary/50">
                    {time}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
