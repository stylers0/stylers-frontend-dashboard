import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchDashboardOverview,
  fetchDashboardStats,
  fetchMachineData,
  fetchServerAnalytics,
  exportToCSV,
  fetchLiveStatus,
  LiveMachineStatus,
  DashboardOverview,
  DashboardStats,
  ServerAnalytics,
  isLargeWindow,
  DISPLAY_ROW_LIMIT,
} from "@/lib/api";
import { getWebSocketClient } from "@/lib/websocket";
import {
  calculateMachineAnalytics,
  formatDuration,
  clipDataToShiftWindow,
} from "@/lib/analytics";
import { useFilters } from "@/context/FilterContext";
import { MachineCard } from "@/components/MachineCard";
import { StatsCard } from "@/components/StatsCard";
import { StatusTimeline } from "@/components/StatusTimeline";
import { FilterBar } from "@/components/FilterBar";
import { DataTable } from "@/components/DataTable";
import { UtilizationGauge } from "@/components/UtilizationGauge";
import { ShiftAnalytics } from "@/components/ShiftAnalytics";
import { MachineStatusModal } from "@/components/MachineStatusModal";
import { Activity, Power, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toLocalISOString } from "@/components/toLocalISOString";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LiveStatus from "./LiveStatus";

function sortMachinesByNumber<T extends { machineName: string }>(
  machines: T[],
): T[] {
  return [...machines].sort((a, b) => {
    const numA = parseInt(a.machineName.replace(/\D/g, ""), 10);
    const numB = parseInt(b.machineName.replace(/\D/g, ""), 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    if (!isNaN(numA)) return -1;
    if (!isNaN(numB)) return 1;
    return a.machineName.localeCompare(b.machineName);
  });
}

const calculateLiveStats = (liveStatus: LiveMachineStatus[]) => ({
  RUNNING: liveStatus.filter((m) => m.status === "RUNNING").length,
  DOWNTIME: liveStatus.filter((m) => m.status === "DOWNTIME").length,
  OFF: liveStatus.filter((m) => m.status === "OFF").length,
  UNKNOWN: liveStatus.filter((m) => m.status === "UNKNOWN").length,
  total: liveStatus.length,
});

export default function Dashboard() {
  const {
    timeFilter,
    setTimeFilter,
    shiftFilter,
    setShiftFilter,
    statusFilter,
    setStatusFilter,
    customFrom,
    customTo,
    setCustomRange,
    dateRange,
    resetAllFilters,
    showResetButton,
    customDateLabel,
  } = useFilters();

  const [liveUpdates, setLiveUpdates] = useState<Record<string, any>>({});
  const [liveStatusData, setLiveStatusData] = useState<LiveMachineStatus[]>([]);
  const [refreshingLive, setRefreshingLive] = useState(false);
  const [modalStatus, setModalStatus] = useState<
    "RUNNING" | "DOWNTIME" | "OFF" | null
  >(null);

  const {
    data: overviewData = [],
    refetch: refetchOverview,
    isLoading: isLoadingOverview,
    isFetching: isFetchingOverview,
  } = useQuery<DashboardOverview[]>({
    queryKey: ["dashboard-overview"],
    queryFn: fetchDashboardOverview,
    refetchInterval: 60000,
    staleTime: 10000,
  });

  const { data: statsData = {} } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: fetchDashboardStats,
    refetchInterval: 60000,
    staleTime: 10000,
  });

  const fetchLiveData = async () => {
    try {
      setRefreshingLive(true);
      const data = await fetchLiveStatus();
      setLiveStatusData(data);
    } catch (err) {
      console.error("Failed to fetch live status", err);
    } finally {
      setRefreshingLive(false);
    }
  };

  const liveStats = useMemo(
    () => calculateLiveStats(liveStatusData),
    [liveStatusData],
  );

  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 60000);
    return () => clearInterval(interval);
  }, []);

  // dateRange comes from useFilters() — shared with MachineDetail

  const largeWindow = isLargeWindow(dateRange.from, dateRange.to);

  const {
    data: machineData = [],
    refetch: refetchMachineData,
    isLoading: isLoadingMachineData,
    isFetching: isFetchingMachineData,
  } = useQuery({
    queryKey: ["machine-data", dateRange.from, dateRange.to],
    queryFn: () =>
      fetchMachineData({
        from: dateRange.from,
        to: dateRange.to,
        // No explicit limit — api.ts applies DISPLAY_ROW_LIMIT automatically.
        // For wide windows the row cap is fine for timeline/table display;
        // analytics totals come from the server-side RPC below.
      }),
    staleTime: 10000,
  });

  // For wide date windows (week / month / 3-months) fetch analytics totals
  // from the database via SUM() aggregation instead of summing client-side
  // over a capped row set — this is accurate regardless of row volume.
  const { data: serverAnalytics = [] } = useQuery<ServerAnalytics[]>({
    queryKey: ["server-analytics", dateRange.from, dateRange.to],
    queryFn: () => fetchServerAnalytics(dateRange.from, dateRange.to),
    enabled: largeWindow,
    staleTime: 30000,
  });

  // ── Clip to the REAL window start (not the buffered fetch start) ──────────
  // This is the core fix for all filters:
  //   "shift"    → clips to 07:00/15:00/23:00 PKT exactly
  //   "day"      → clips to exactly 24h ago (e.g. yesterday 10:20 AM)
  //   "week"     → clips to exactly 7 days ago
  //   "custom"   → clips to exactly the from-date/time the user picked
  const displayData = useMemo(() => {
    return clipDataToShiftWindow(machineData, dateRange.realFrom, dateRange.to);
  }, [machineData, dateRange.realFrom, dateRange.to]);

  // Custom range reset is handled inside setTimeFilter() in FilterContext

  useEffect(() => {
    const ws = getWebSocketClient();
    const unsubscribe = ws.subscribe((message) => {
      if (
        message.type === "machine_update" ||
        message.type === "live_status_update"
      ) {
        if (message.machine) {
          setLiveUpdates((prev) => ({ ...prev, [message.machine!]: message }));
        }
        refetchOverview();
        fetchLiveData();
        if (message.machine && message.status) {
          toast.success(`${message.machine} updated: ${message.status}`);
        }
      }
    });
    return () => unsubscribe();
  }, [refetchOverview]);

  const machineAnalytics = useMemo(() => {
    return overviewData.reduce(
      (acc, machine) => {
        if (largeWindow && serverAnalytics.length > 0) {
          // Use server-computed totals for wide windows — accurate regardless
          // of how many rows the display query returned.
          const sa = serverAnalytics.find(
            (s) => s.machineName === machine.machineName,
          );
          if (sa) {
            const total =
              sa.runningSeconds + sa.downtimeSeconds + sa.offSeconds;
            const active = sa.runningSeconds + sa.downtimeSeconds;
            acc[machine.machineName] = {
              totalRecords: sa.totalRecords,
              runningTime: sa.runningSeconds,
              downtimeTime: sa.downtimeSeconds,
              offTime: sa.offSeconds,
              runningPercentage:
                total > 0 ? (sa.runningSeconds / total) * 100 : 0,
              downtimePercentage:
                total > 0 ? (sa.downtimeSeconds / total) * 100 : 0,
              offPercentage: total > 0 ? (sa.offSeconds / total) * 100 : 0,
              utilizationPercentage:
                active > 0 ? (sa.runningSeconds / active) * 100 : 0,
              efficiencyPercentage:
                active > 0 ? (sa.runningSeconds / active) * 100 : 0,
              longestRunDuration: 0,
              numberOfOffs: 0,
              averageOffDuration: 0,
              averageDowntimeDuration: 0,
              statusCounts: {
                RUNNING: 0,
                DOWNTIME: 0,
                OFF: 0,
              },
            };
            return acc;
          }
        }
        // Short window or RPC not yet available — compute from fetched rows.
        const machineRecords = displayData.filter(
          (d) => d.machineName === machine.machineName,
        );
        acc[machine.machineName] = calculateMachineAnalytics(machineRecords);
        return acc;
      },
      {} as Record<string, any>,
    );
  }, [overviewData, displayData, largeWindow, serverAnalytics]);

  const overallAnalytics = useMemo(() => {
    if (largeWindow && serverAnalytics.length > 0) {
      const totals = serverAnalytics.reduce(
        (acc, sa) => {
          acc.running += sa.runningSeconds;
          acc.downtime += sa.downtimeSeconds;
          acc.off += sa.offSeconds;
          acc.records += sa.totalRecords;
          return acc;
        },
        { running: 0, downtime: 0, off: 0, records: 0 },
      );
      const total = totals.running + totals.downtime + totals.off;
      const active = totals.running + totals.downtime;
      return {
        totalRecords: totals.records,
        runningTime: totals.running,
        downtimeTime: totals.downtime,
        offTime: totals.off,
        runningPercentage: total > 0 ? (totals.running / total) * 100 : 0,
        downtimePercentage: total > 0 ? (totals.downtime / total) * 100 : 0,
        offPercentage: total > 0 ? (totals.off / total) * 100 : 0,
        utilizationPercentage: active > 0 ? (totals.running / active) * 100 : 0,
        efficiencyPercentage: active > 0 ? (totals.running / active) * 100 : 0,
        longestRunDuration: 0,
        numberOfOffs: 0,
        averageOffDuration: 0,
        averageDowntimeDuration: 0,
        statusCounts: { RUNNING: 0, DOWNTIME: 0, OFF: 0 },
      };
    }
    return calculateMachineAnalytics(displayData);
  }, [displayData, largeWindow, serverAnalytics]);

  const getMachineLiveStatus = (
    machineName: string,
  ): LiveMachineStatus | undefined =>
    liveStatusData.find((m) => m.machine === machineName);

  const handleExport = async () => {
    try {
      const blob = await exportToCSV({
        from: dateRange.realFrom,
        to: dateRange.to,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `factory-report-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Report exported successfully!");
    } catch (error) {
      toast.error("Failed to export report");
    }
  };

  const isInitialLoading = isLoadingOverview && overviewData.length === 0;
  const isUpdating = isFetchingOverview || isFetchingMachineData;

  const handleResetAllFilters = () => {
    resetAllFilters();
    toast.success("All filters have been reset");
  };

  const currentFilters = useMemo(() => {
    const timeRangeMap: Record<string, string> = {
      shift: "Current Shift",
      day: "Last 24 Hours",
      week: "Last Week",
      month: "Last Month",
      "3months": "Last 3 Months",
    };
    const filters: any = { timeRange: timeRangeMap[timeFilter] || timeFilter };
    if (shiftFilter && shiftFilter !== "All") filters.shift = shiftFilter;
    if (customDateLabel) filters.customDate = customDateLabel;
    return filters;
  }, [timeFilter, shiftFilter, customDateLabel]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold text-foreground">
              Factory Dashboard
            </h1>
            {isUpdating && (
              <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full animate-pulse">
                Updating...
              </span>
            )}
          </div>
          <p className="text-muted-foreground">
            Real-time monitoring and comprehensive analytics for all machines
          </p>
        </div>

        <FilterBar
          timeFilter={timeFilter}
          onTimeFilterChange={setTimeFilter}
          shiftFilter={shiftFilter}
          onShiftFilterChange={setShiftFilter}
          currentCustomFrom={customFrom}
          currentCustomTo={customTo}
          onCustomDateChange={(from, to) => {
            setCustomRange(from ?? null, to ?? null);
          }}
          onExport={handleExport}
          onRefresh={() => {
            refetchOverview();
            refetchMachineData();
            fetchLiveData();
            toast.success("Dashboard refreshed");
          }}
          onResetFilters={handleResetAllFilters}
          showShiftFilter
          showResetButton={showResetButton}
          currentFilters={currentFilters}
        />

        {/* Info banner for wide date windows */}
        {largeWindow && (
          <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
            <span className="mt-0.5 shrink-0">ℹ️</span>
            <span>
              <strong>Wide date range selected.</strong> Analytics totals
              (Running / Downtime / Off %) are calculated in the database for
              full accuracy across all records. The timeline and data table show
              the most recent{" "}
              <strong>{DISPLAY_ROW_LIMIT.toLocaleString()}</strong> events — use{" "}
              <em>Export CSV</em> to download the complete dataset.
            </span>
          </div>
        )}

        {isInitialLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
              <span className="text-lg text-muted-foreground">
                Loading dashboard...
              </span>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="live" className="space-y-6">
            <TabsList className="grid w-full max-w-lg grid-cols-3">
              <TabsTrigger value="live">Live</TabsTrigger>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="data">Status Data</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <Card className="p-6">
                <h2 className="text-2xl font-bold mb-2">Machines Efficiency</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Efficiency = Total Running / (Running + Downtime) — OFF
                  excluded
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <UtilizationGauge
                    value={overallAnalytics.efficiencyPercentage || 0}
                    title="Overall Efficiency"
                    subtitle="Running vs Downtime only"
                  />
                  <div className="flex flex-col justify-center space-y-4">
                    <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                      <span className="text-muted-foreground">
                        Running Time
                      </span>
                      <span className="font-bold text-success">
                        {Math.round(overallAnalytics.runningPercentage)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                      <span className="text-muted-foreground">Downtime</span>
                      <span className="font-bold text-warning">
                        {Math.round(overallAnalytics.downtimePercentage)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                      <span className="text-muted-foreground">Off Time</span>
                      <span className="font-bold text-destructive">
                        {Math.round(overallAnalytics.offPercentage)}%
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortMachinesByNumber(overviewData).map((machine) => {
                  const analytics = machineAnalytics[machine.machineName] || {};
                  const liveStatus = getMachineLiveStatus(machine.machineName);
                  return (
                    <MachineCard
                      key={machine.machineName}
                      machineName={machine.machineName}
                      status={machine.latestStatus as any}
                      lastUpdate={machine.lastTimestamp}
                      shift={machine.shift}
                      runningPercentage={Math.round(
                        analytics.runningPercentage || 0,
                      )}
                      downtimePercentage={Math.round(
                        analytics.downtimePercentage || 0,
                      )}
                      offPercentage={Math.round(analytics.offPercentage || 0)}
                      liveStatus={liveStatus}
                    />
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="live" className="space-y-6">
              <LiveStatus />
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <StatusTimeline
                data={displayData}
                title="Status Timeline (Scroll left for history)"
              />
              <ShiftAnalytics data={displayData} timeFilter={timeFilter} />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    Running Statistics
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">
                        Total Time
                      </span>
                      <span className="font-medium text-success">
                        {formatDuration(overallAnalytics.runningTime)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">
                        Events
                      </span>
                      <span className="font-medium">
                        {overallAnalytics.statusCounts?.RUNNING || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">
                        Longest Run
                      </span>
                      <span className="font-medium">
                        {formatDuration(overallAnalytics.longestRunDuration)}
                      </span>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    Downtime Statistics
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">
                        Total Time
                      </span>
                      <span className="font-medium text-warning">
                        {formatDuration(overallAnalytics.downtimeTime)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">
                        Events
                      </span>
                      <span className="font-medium">
                        {overallAnalytics.statusCounts?.DOWNTIME || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">
                        Avg Duration
                      </span>
                      <span className="font-medium">
                        {formatDuration(
                          overallAnalytics.averageDowntimeDuration,
                        )}
                      </span>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    Off Time Statistics
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">
                        Total Time
                      </span>
                      <span className="font-medium text-destructive">
                        {formatDuration(overallAnalytics.offTime)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">
                        Events
                      </span>
                      <span className="font-medium">
                        {overallAnalytics.statusCounts?.OFF || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">
                        Avg Duration
                      </span>
                      <span className="font-medium">
                        {formatDuration(overallAnalytics.averageOffDuration)}
                      </span>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    Efficiency Analysis
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">
                        Efficiency
                      </span>
                      <span className="font-bold text-primary">
                        {Math.round(overallAnalytics.efficiencyPercentage)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">
                        Total Records
                      </span>
                      <span className="font-medium">
                        {overallAnalytics.totalRecords}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">
                        Off Transitions
                      </span>
                      <span className="font-medium">
                        {overallAnalytics.numberOfOffs}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>

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
                data={displayData}
                statusFilter={statusFilter}
                title="Recent Machines Data"
                maxRows={1000}
                isLoading={isFetchingMachineData}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>

      {modalStatus && (
        <MachineStatusModal
          isOpen={!!modalStatus}
          onClose={() => setModalStatus(null)}
          status={modalStatus}
          machines={overviewData}
        />
      )}
    </div>
  );
}
