import { Card } from "@/components/ui/card";
import { MachineData } from "@/lib/api";
import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  parsePKTTimestamp,
  formatDisplayDate,
  formatDisplayTime,
} from "@/lib/timeUtils";

interface StatusTimelineProps {
  data: MachineData[];
  title?: string;
  machineName?: string;
}

const STATUS_COLORS = {
  RUNNING: "bg-green-500",
  DOWNTIME: "bg-amber-500",
  OFF: "bg-red-500",
  UNKNOWN: "bg-gray-300",
};

const STATUS_LABELS = {
  RUNNING: "Running",
  DOWNTIME: "Downtime",
  OFF: "Off",
  UNKNOWN: "Unknown",
};

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

// ── Tooltip position state ───────────────────────────────────────────────────
interface TooltipState {
  index: number;
  x: number; // left px (viewport-relative, already clamped)
  y: number; // top px (viewport-relative, above the segment)
  segment: MachineData;
  startTime: Date;
  endTime: Date;
  duration: number;
}

// Tooltip width — must match the min-w in the tooltip JSX below
const TOOLTIP_WIDTH = 200;
const TOOLTIP_HEIGHT = 140; // approximate
const MARGIN = 8; // px gap from viewport edge

export function StatusTimeline({
  data,
  title = "Status Timeline",
  machineName,
}: StatusTimelineProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  // Filter and sort data — always ascending for timeline
  const filteredData = machineName
    ? data.filter((d) => d.machineName === machineName)
    : data;

  const sortedData = useMemo(
    () =>
      [...filteredData].sort(
        (a, b) =>
          parsePKTTimestamp(a.timestamp).getTime() -
          parsePKTTimestamp(b.timestamp).getTime(),
      ),
    [filteredData],
  );

  const totalDuration = sortedData.reduce(
    (acc, d) => acc + (d.durationSeconds || 0),
    0,
  );

  // Resize handler
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // Hide tooltip on scroll so it doesn't float in the wrong place
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hide = () => setTooltip(null);
    el.addEventListener("scroll", hide);
    return () => el.removeEventListener("scroll", hide);
  }, []);

  // Segment widths
  const segmentWidths = useMemo(
    () =>
      sortedData.map((segment) => {
        const duration = segment.durationSeconds || 0;
        return Math.max((duration / totalDuration) * containerWidth, 60);
      }),
    [sortedData, totalDuration, containerWidth],
  );

  const totalWidth = segmentWidths.reduce((sum, w) => sum + w, 0);

  // Visible time labels
  const visibleLabels = useMemo(() => {
    const labels: { time: string; position: number; date?: string }[] = [];
    let cumulativePos = 0;
    sortedData.forEach((segment, i) => {
      const startTime = parsePKTTimestamp(segment.timestamp);
      const width = segmentWidths[i];
      const shouldShow =
        i === 0 ||
        i === sortedData.length - 1 ||
        width > 100 ||
        i % Math.max(1, Math.floor(sortedData.length / 8)) === 0;
      if (shouldShow) {
        labels.push({
          time: formatDisplayTime(startTime),
          position: cumulativePos,
          date: i === 0 ? formatDisplayDate(startTime) : undefined,
        });
      }
      cumulativePos += width;
    });
    return labels;
  }, [sortedData, segmentWidths]);

  // Scroll to end on mount
  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current!.scrollLeft = scrollRef.current!.scrollWidth;
      }, 100);
    }
  }, [sortedData.length]);

  // ── Mouse enter handler — compute clamped viewport position ──────────────
  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, index: number) => {
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const segment = sortedData[index];
      const duration = segment.durationSeconds || 0;
      const startTime = parsePKTTimestamp(segment.timestamp);
      const endTime = new Date(startTime.getTime() + duration * 1000);

      // Ideal: horizontally centred above the segment
      let x = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      let y = rect.top - TOOLTIP_HEIGHT - 12; // 12px gap above segment

      // Clamp horizontally so tooltip never goes off-screen
      x = Math.max(
        MARGIN,
        Math.min(x, window.innerWidth - TOOLTIP_WIDTH - MARGIN),
      );

      // If not enough room above, show below instead
      if (y < MARGIN) {
        y = rect.bottom + 12;
      }

      setTooltip({ index, x, y, segment, startTime, endTime, duration });
    },
    [sortedData],
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  if (sortedData.length === 0) {
    return (
      <div className="p-6">
        <h3 className="text-lg font-bold mb-4">{title}</h3>
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          No data available for timeline
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Legend */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold">{title}</h3>
        <div className="flex items-center gap-4 text-sm">
          {Object.entries(STATUS_LABELS).map(
            ([key, label]) =>
              key !== "UNKNOWN" && (
                <div key={key} className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded ${
                      STATUS_COLORS[key as keyof typeof STATUS_COLORS]
                    }`}
                  />
                  <span>{label}</span>
                </div>
              ),
          )}
        </div>
      </div>

      <div ref={containerRef} className="mb-6">
        <ScrollArea ref={scrollRef}>
          <div
            className="relative pt-4 pb-2"
            style={{ width: `${totalWidth}px` }}>
            {/* Date header */}
            <div className="mb-2 text-sm font-medium text-gray-600">
              {sortedData.length > 0 &&
                formatDisplayDate(parsePKTTimestamp(sortedData[0].timestamp))}
            </div>

            {/* Timeline bar */}
            <div className="flex h-16 rounded-lg border border-gray-200 shadow-sm">
              {sortedData.map((segment, index) => {
                const width = segmentWidths[index];
                return (
                  <div
                    key={segment._id || index}
                    className={`relative ${
                      STATUS_COLORS[segment.status] || STATUS_COLORS.UNKNOWN
                    } cursor-pointer transition-all duration-200 hover:brightness-110`}
                    style={{ width: `${width}px`, minWidth: "60px" }}
                    onMouseEnter={(e) => handleMouseEnter(e, index)}
                    onMouseLeave={handleMouseLeave}>
                    {/* Duration label inside segment */}
                    {width > 40 && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded bg-black/20 backdrop-blur-sm ${
                            segment.status === "DOWNTIME"
                              ? "text-gray-900"
                              : "text-white"
                          }`}>
                          {formatDuration(segment.durationSeconds || 0)}
                        </span>
                      </div>
                    )}
                    {/* Separator */}
                    {index < sortedData.length - 1 && (
                      <div className="absolute right-0 top-0 h-full w-px bg-gray-800/30 pointer-events-none" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Time labels */}
            <div className="relative mt-3 h-8">
              {visibleLabels.map((label, index) => (
                <div
                  key={`label-${index}`}
                  className="absolute text-xs text-gray-600"
                  style={{
                    left: `${label.position}px`,
                    transform: "translateX(-50%)",
                  }}>
                  <div className="flex flex-col items-center">
                    <div className="font-medium whitespace-nowrap">
                      {label.time}
                    </div>
                    {label.date && (
                      <div className="text-[10px] text-gray-400 mt-1">
                        {label.date}
                      </div>
                    )}
                    <div className="w-px h-3 bg-gray-300 mt-1" />
                  </div>
                </div>
              ))}

              {/* End time label */}
              {sortedData.length > 0 &&
                (() => {
                  const last = sortedData[sortedData.length - 1];
                  const endTime = new Date(
                    parsePKTTimestamp(last.timestamp).getTime() +
                      (last.durationSeconds || 0) * 1000,
                  );
                  const endLabel = formatDisplayTime(endTime);
                  const alreadyShown = visibleLabels.some(
                    (l) => l.time === endLabel,
                  );
                  if (alreadyShown) return null;
                  return (
                    <div
                      className="absolute text-xs text-gray-600"
                      style={{
                        left: `${totalWidth}px`,
                        transform: "translateX(-100%)",
                      }}>
                      <div className="flex flex-col items-center">
                        <div className="font-medium whitespace-nowrap">
                          {endLabel}
                        </div>
                        <div className="w-px h-3 bg-gray-300 mt-1" />
                      </div>
                    </div>
                  );
                })()}
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Summary stats */}
      <div className="border-t pt-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-4">
          Status Summary
        </h4>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(STATUS_LABELS).map(([status, label]) => {
            if (status === "UNKNOWN") return null;
            const statusData = sortedData.filter((d) => d.status === status);
            const totalSeconds = statusData.reduce(
              (acc, d) => acc + (d.durationSeconds || 0),
              0,
            );
            const count = statusData.length;
            const percentage =
              totalDuration > 0
                ? ((totalSeconds / totalDuration) * 100).toFixed(1)
                : "0.0";
            return (
              <div
                key={status}
                className="text-center p-4 rounded-lg border bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div
                    className={`w-3 h-3 rounded ${
                      STATUS_COLORS[status as keyof typeof STATUS_COLORS]
                    }`}
                  />
                  <div
                    className={`text-sm font-semibold ${
                      status === "RUNNING"
                        ? "text-green-700"
                        : status === "DOWNTIME"
                          ? "text-amber-700"
                          : "text-red-700"
                    }`}>
                    {label}
                  </div>
                </div>
                <div className="text-2xl font-bold mb-1">
                  {formatDuration(totalSeconds)}
                </div>
                <div className="text-xs text-gray-500">
                  <div>{percentage}% of total time</div>
                  <div>
                    {count} event{count !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Portal tooltip — renders on document.body, never clipped ── */}
      {tooltip &&
        createPortal(
          <div
            className="fixed z-[99999] pointer-events-none"
            style={{ left: tooltip.x, top: tooltip.y }}>
            <div
              className="bg-gray-900 text-white text-xs rounded-lg shadow-xl p-3 border border-gray-700"
              style={{ width: `${TOOLTIP_WIDTH}px` }}>
              <div className="font-bold mb-2 text-sm">
                {tooltip.segment.machineName}
              </div>
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    STATUS_COLORS[tooltip.segment.status]
                  }`}
                />
                <span className="font-medium">
                  {STATUS_LABELS[tooltip.segment.status]}
                </span>
              </div>
              <div className="space-y-1 text-gray-300">
                <div className="flex justify-between">
                  <span>Start:</span>
                  <span>{formatDisplayTime(tooltip.startTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span>End:</span>
                  <span>{formatDisplayTime(tooltip.endTime)}</span>
                </div>
                <div className="flex justify-between font-medium mt-2 pt-2 border-t border-gray-700">
                  <span>Duration:</span>
                  <span>{formatDuration(tooltip.duration)}</span>
                </div>
              </div>
            </div>
            {/* Arrow — points down toward the segment */}
            <div className="flex justify-center mt-0">
              <div className="w-2 h-2 bg-gray-900 rotate-45 -mt-1" />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
