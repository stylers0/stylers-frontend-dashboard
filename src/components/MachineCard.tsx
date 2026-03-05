import { Card } from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";
import { Progress } from "@/components/ui/progress";
import { Activity, Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import {
  parsePKTTimestamp,
  formatDisplayDateTime,
  formatTimeAgo,
} from "@/lib/timeUtils";
import { Badge } from "@/components/ui/badge";
import { LiveMachineStatus } from "@/lib/api";
import { PreviousStatusBadge } from "./PreviousStatusBadge";

interface MachineCardProps {
  machineName: string;
  status: "RUNNING" | "DOWNTIME" | "OFF" | "UNKNOWN";
  lastUpdate: string;
  shift?: string | null;
  runningPercentage?: number;
  downtimePercentage?: number;
  offPercentage?: number;
  className?: string;
  liveStatus?: LiveMachineStatus;
}

export function MachineCard({
  machineName,
  status,
  lastUpdate,
  shift,
  runningPercentage = 0,
  downtimePercentage = 0,
  offPercentage = 0,
  className,
  liveStatus,
}: MachineCardProps) {
  // Parse the PKT timestamp from the API (already in PKT, not UTC)
  const dateObj = parsePKTTimestamp(lastUpdate);
  const formattedLastUpdate = formatDisplayDateTime(dateObj);
  const lastStatus = true;

  // Format live update time
  const liveUpdateTime = liveStatus?.updatedAt
    ? formatTimeAgo(new Date(liveStatus.updatedAt))
    : null;

  return (
    <Link to={`/machine/${machineName}`}>
      <Card
        className={cn(
          "p-6 hover:shadow-lg transition-all duration-300 cursor-pointer border-2 flex flex-col h-full w-full",

          status === "RUNNING" && "hover:border-success/50",
          status === "DOWNTIME" && "hover:border-warning/50",
          status === "OFF" && "hover:border-destructive/50",
          className,
        )}>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">
                {machineName}
              </h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {/* <Clock className="w-3 h-3" /> */}
                <span className="w-full">
                  Last Updated Event:{" "}
                  <span className="font-bold">{formattedLastUpdate}</span>
                </span>
              </div>
              <div className="mt-4"></div>

              <span className="mr-1 text-xs text-muted-foreground">
                Last Status was
              </span>
              <PreviousStatusBadge status={status} />
            </div>

            {/* Status with live indicator */}
            <div className="flex flex-col items-end gap-2">
              {liveStatus && (
                <StatusBadge status={liveStatus?.status} showPulse />
              )}

              {/* {liveStatus && ( */}
              {/* <Badge
                variant="outline"
                className="text-xs px-2 py-1 flex items-center gap-1 bg-blue-50 text-blue-700 border-blue-200">
                <RefreshCw className="w-3 h-3" />
                Prev Status: {status}
              </Badge> */}
              {/* )} */}
            </div>
          </div>

          {/* Shift Badge */}
          {/* {shift && (
            <div
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold border
      ${
        shift === "Morning"
          ? "bg-yellow-100 text-yellow-800 border-yellow-400"
          : shift === "Evening"
            ? "bg-orange-100 text-orange-800 border-orange-400"
            : shift === "Night"
              ? "bg-indigo-100 text-indigo-800 border-indigo-400"
              : "bg-secondary text-foreground border-border"
      }
    `}>
              <Activity className="w-3 h-3" />
              {shift}
            </div>
          )} */}

          {/* Status Progress Bars */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">
                  Running
                </span>
                <span className="font-bold text-success">
                  {runningPercentage.toFixed(1)}%
                </span>
              </div>
              <Progress value={runningPercentage} className="h-2 bg-success/10">
                <div
                  className="h-full bg-success transition-all rounded-full"
                  style={{ width: `${runningPercentage}%` }}
                />
              </Progress>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">
                  Downtime
                </span>
                <span className="font-bold text-warning">
                  {downtimePercentage.toFixed(1)}%
                </span>
              </div>
              <Progress
                value={downtimePercentage}
                className="h-2 bg-warning/10">
                <div
                  className="h-full bg-warning transition-all rounded-full"
                  style={{ width: `${downtimePercentage}%` }}
                />
              </Progress>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Off</span>
                <span className="font-bold text-destructive">
                  {offPercentage.toFixed(1)}%
                </span>
              </div>
              <Progress value={offPercentage} className="h-2 bg-destructive/10">
                <div
                  className="h-full bg-destructive transition-all rounded-full"
                  style={{ width: `${offPercentage}%` }}
                />
              </Progress>
            </div>
          </div>

          {/* Current vs Live Status */}
          {liveStatus && status !== liveStatus.status && (
            <div className="mt-3 p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">Status changed:</span>
                  <span className="font-medium line-through">{status}</span>
                  <span className="text-gray-400">→</span>
                  <span
                    className={cn(
                      "font-bold",
                      liveStatus.status === "RUNNING" && "text-green-600",
                      liveStatus.status === "DOWNTIME" && "text-yellow-600",
                      liveStatus.status === "OFF" && "text-red-600",
                    )}>
                    {liveStatus.status}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
