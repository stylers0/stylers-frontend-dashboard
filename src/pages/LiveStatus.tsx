import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchLiveStatus, LiveMachineStatus } from "@/lib/api";
import { getWebSocketClient } from "@/lib/websocket";
import { formatDisplayDateTime, parsePKTTimestamp } from "@/lib/timeUtils";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  PlayCircle,
  AlertCircle,
  PowerOff,
  HelpCircle,
  Power,
  Clock,
  RefreshCw,
  ArrowRight,
  Filter,
  X,
} from "lucide-react";

const getStatusConfig = (status: string) => {
  switch (status) {
    case "RUNNING":
      return {
        color: "bg-green-100 text-green-800 border-green-300",
        icon: PlayCircle,
        bgColor: "bg-green-50",
        progressColor: "bg-green-500",
        buttonColor:
          "border-green-200 bg-gradient-to-br from-green-50 to-green-50/50 hover:from-green-100",
      };
    case "DOWNTIME":
      return {
        color: "bg-yellow-100 text-yellow-800 border-yellow-300",
        icon: AlertCircle,
        bgColor: "bg-yellow-50",
        progressColor: "bg-yellow-500",
        buttonColor:
          "border-yellow-200 bg-gradient-to-br from-yellow-50 to-yellow-50/50 hover:from-yellow-100",
      };
    case "OFF":
      return {
        color: "bg-red-100 text-red-800 border-red-300",
        icon: PowerOff,
        bgColor: "bg-red-50",
        progressColor: "bg-red-500",
        buttonColor:
          "border-red-200 bg-gradient-to-br from-red-50 to-red-50/50 hover:from-red-100",
      };
    default:
      return {
        color: "bg-gray-100 text-gray-800 border-gray-300",
        icon: HelpCircle,
        bgColor: "bg-gray-50",
        progressColor: "bg-gray-500",
        buttonColor:
          "border-gray-200 bg-gradient-to-br from-gray-50 to-gray-50/50 hover:from-gray-100",
      };
  }
};

const LiveStatus = () => {
  const [machines, setMachines] = useState<LiveMachineStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // ── Core fetch function ───────────────────────────────────────────────────
  const fetchData = useCallback(async (showToast = false) => {
    try {
      setRefreshing(true);
      const live = await fetchLiveStatus();
      setMachines(live);
      setLastUpdated(new Date());
      if (showToast) {
        toast.success("Live status refreshed successfully");
      }
    } catch (err) {
      console.error("Failed to fetch live status", err);
      if (showToast) {
        toast.error("Failed to refresh live status");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── Initial load + auto-refresh every 60 seconds ─────────────────────────
  useEffect(() => {
    fetchData(false);
    const interval = setInterval(() => {
      fetchData(false); // silent background refresh
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── WebSocket for real-time updates ──────────────────────────────────────
  useEffect(() => {
    const ws = getWebSocketClient();
    const unsubscribe = ws.subscribe((message) => {
      if (message.type === "live_status_update" && message.machine) {
        setMachines((prev) => {
          const idx = prev.findIndex((m) => m.machine === message.machine);
          const updated: LiveMachineStatus = {
            machine: message.machine!,
            status: message.status as any,
            machinePower: message.status !== "OFF",
            downtime: message.status === "DOWNTIME",
            updatedAt: message.timestamp ?? new Date().toISOString(),
          };
          if (idx === -1) return [...prev, updated];
          const next = [...prev];
          next[idx] = updated;
          return next;
        });
        setLastUpdated(new Date());
      }
    });
    return () => unsubscribe();
  }, []);

  // Manual refresh — shows toast
  const handleRefresh = () => fetchData(true);

  const extractMachineNumber = (machineName: string): number => {
    const match = machineName.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  const sortedMachines = useMemo(() => {
    return [...machines].sort((a, b) => {
      return extractMachineNumber(a.machine) - extractMachineNumber(b.machine);
    });
  }, [machines]);

  const filteredMachines = useMemo(() => {
    if (!activeFilter) return sortedMachines;
    return sortedMachines.filter((machine) => machine.status === activeFilter);
  }, [sortedMachines, activeFilter]);

  const handleFilterClick = (status: string) => {
    setActiveFilter((prev) => (prev === status ? null : status));
  };

  const clearFilter = () => setActiveFilter(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-lg font-medium text-gray-600">
            Loading machine status...
          </p>
        </div>
      </div>
    );
  }

  const runningCount = machines.filter((m) => m.status === "RUNNING").length;
  const downtimeCount = machines.filter((m) => m.status === "DOWNTIME").length;
  const offCount = machines.filter((m) => m.status === "OFF").length;
  const totalMachines = machines.length;

  const SummaryCard = ({
    title,
    count,
    color,
    icon: Icon,
    status,
  }: {
    title: string;
    count: number;
    color: string;
    icon: any;
    status: string;
  }) => (
    <button
      onClick={() => handleFilterClick(status)}
      className={`${color} border-2 transition-all duration-200 hover:shadow-md w-full rounded-md`}>
      <Card className="h-full border-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-start flex-col justify-start">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-600">{title}</p>
              </div>
              <h3 className="text-3xl font-bold mt-2">{count}</h3>
              <p className="text-sm text-gray-500 mt-1">
                {totalMachines > 0
                  ? `${Math.round((count / totalMachines) * 100)}%`
                  : "0%"}
              </p>
            </div>
            <div className="p-3 rounded-full bg-white/50">
              <Icon className="w-6 h-6" />
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  );

  return (
    <div className="mt-4 space-y-6 mx-auto max-w-[1360px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Live Machine Status
          </h1>
          <p className="text-gray-600 mt-1">
            Real-time monitoring of all machines
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          className="gap-2"
          disabled={refreshing}>
          <RefreshCw
            className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
          />
          {refreshing ? "Refreshing..." : "Refresh Live Status"}
        </Button>
      </div>

      {/* Active Filter Indicator */}
      {activeFilter && (
        <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium">
                Showing {filteredMachines.length} {activeFilter.toLowerCase()}{" "}
                machine
                {filteredMachines.length !== 1 ? "s" : ""}
              </p>
              <p className="text-sm text-gray-600">
                Click on a status card to filter machines
              </p>
            </div>
          </div>
          <Button
            onClick={clearFilter}
            variant="ghost"
            size="sm"
            className="gap-2">
            <X className="w-4 h-4" />
            Clear Filter
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Machines"
          count={totalMachines}
          color="border-grey-200 bg-gradient-to-br from-gray-50 to-gray-50/50 hover:from-green-100"
          icon={Power}
          status=""
        />
        <SummaryCard
          title="Running"
          count={runningCount}
          color="border-green-200 bg-gradient-to-br from-green-50 to-green-50/50 hover:from-green-100"
          icon={PlayCircle}
          status="RUNNING"
        />
        <SummaryCard
          title="Downtime"
          count={downtimeCount}
          color="border-yellow-200 bg-gradient-to-br from-yellow-50 to-yellow-50/50 hover:from-yellow-100"
          icon={AlertCircle}
          status="DOWNTIME"
        />
        <SummaryCard
          title="Off"
          count={offCount}
          color="border-red-200 bg-gradient-to-br from-red-50 to-red-50/50 hover:from-red-100"
          icon={PowerOff}
          status="OFF"
        />
      </div>

      {/* Machine Grid */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold">
              All Machines ({totalMachines})
            </h2>
            {activeFilter && (
              <p className="text-sm text-gray-600 mt-1">
                Filtered by: <span className="font-medium">{activeFilter}</span>
              </p>
            )}
          </div>
          <p className="text-sm text-gray-500">
            Updates in real-time via Supabase
          </p>
        </div>

        {filteredMachines.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <HelpCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600">
                {activeFilter
                  ? `No ${activeFilter.toLowerCase()} machines`
                  : "No machines found"}
              </h3>
              <p className="text-gray-500 mt-1">
                {activeFilter
                  ? `There are no machines with ${activeFilter.toLowerCase()} status.`
                  : "There are no machines to display at the moment."}
              </p>
              {activeFilter && (
                <Button
                  onClick={clearFilter}
                  variant="outline"
                  className="mt-4">
                  Clear Filter
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3">
            {filteredMachines.map((machine) => {
              const dateObj = parsePKTTimestamp(machine.updatedAt);
              const formattedLastUpdate = formatDisplayDateTime(dateObj);
              const statusConfig = getStatusConfig(machine.status);
              const StatusIcon = statusConfig.icon;
              const machineNumber = extractMachineNumber(machine.machine);

              return (
                <Link
                  key={machine.machine}
                  to={`/machine/${machine.machine}`}
                  className="transition-all hover:scale-[1.02] hover:shadow-lg">
                  <Card
                    className={`h-full border-2 ${statusConfig.bgColor} hover:border-primary/30 transition-colors min-h-[200px] flex flex-col`}>
                    <CardHeader className="pb-2 px-4 pt-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <div className="min-w-0">
                            <CardTitle className="text-base font-bold truncate">
                              {machineNumber !== 0 && "Machine"}
                              {machineNumber === 0 ? "Hanger" : machineNumber}
                            </CardTitle>
                            <CardDescription className="text-xs truncate mt-1">
                              ID: {machine.machine}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge
                          className={`${statusConfig.color} font-semibold px-2 py-1 flex items-center justify-center gap-1 w-full text-xs`}>
                          <StatusIcon className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{machine.status}</span>
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="px-4 pb-4 pt-0 flex-grow flex flex-col">
                      <div className="flex items-start flex-wrap gap-2 p-2 bg-white/50 rounded-lg border mb-3 flex-grow">
                        <Clock className="w-3 h-3 mt-0.5 text-gray-500 flex-shrink-0" />
                        <p className="text-xs text-gray-500 truncate">
                          Last Updated
                        </p>
                        <p className="text-xs font-medium truncate">
                          {formattedLastUpdate}
                        </p>
                      </div>
                      <div className="pt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-between group text-xs h-8">
                          <span className="truncate">Details</span>
                          <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1 flex-shrink-0" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer — shows live last-updated time */}
      <div className="text-center pt-4">
        <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
          <Clock className="w-3 h-3" />
          Last refreshed:{" "}
          {lastUpdated.toLocaleTimeString("en-US", {
            timeZone: "Asia/Karachi",
          })}{" "}
          PKT
          <span className="text-xs text-gray-400">
            (auto-refreshes every 60s)
          </span>
        </p>
      </div>
    </div>
  );
};

export default LiveStatus;
