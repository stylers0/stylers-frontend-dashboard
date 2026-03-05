import { Card } from "@/components/ui/card";
import { MachineData } from "@/lib/api";
import { useRef, useEffect, useState, useMemo } from "react";
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

  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  } else {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
}

export function StatusTimeline({
  data,
  title = "Status Timeline",
  machineName,
}: StatusTimelineProps) {
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  // Filter and sort data
  const filteredData = machineName
    ? data.filter((d) => d.machineName === machineName)
    : data;

  const sortedData = useMemo(
    () =>
      [...filteredData].sort(
        (a, b) =>
          parsePKTTimestamp(a.timestamp).getTime() -
          parsePKTTimestamp(b.timestamp).getTime()
      ),
    [filteredData]
  );

  // Calculate total duration
  const totalDuration = sortedData.reduce(
    (acc, d) => acc + (d.durationSeconds || 0),
    0
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

  // Calculate time positions and visible labels
  const { timePositions, visibleLabels } = useMemo(() => {
    if (sortedData.length === 0)
      return { timePositions: [], visibleLabels: [] };

    const positions: {
      time: string;
      position: number;
      date: string;
      showDate: boolean;
    }[] = [];
    const labels: { time: string; position: number; date?: string }[] = [];

    // Calculate cumulative positions
    let cumulativePos = 0;
    const segmentWidths: number[] = [];

    // Calculate segment widths proportionally
    sortedData.forEach((segment) => {
      const duration = segment.durationSeconds || 0;
      const width = Math.max((duration / totalDuration) * containerWidth, 60);
      segmentWidths.push(width);
    });

    // Group segments into logical groups for labeling
    for (let i = 0; i < sortedData.length; i++) {
      const segment = sortedData[i];
      const startTime = parsePKTTimestamp(segment.timestamp);
      const segmentWidth = segmentWidths[i];
      const segmentCenter = cumulativePos + segmentWidth / 2;

      // Store position for this segment's start
      positions.push({
        time: formatDisplayTime(startTime),
        position: cumulativePos,
        date: formatDisplayDate(startTime),
        showDate: i === 0, // Show date only for first segment
      });

      // Decide if we should show a label at this position
      // Show label for: first segment, last segment, and at reasonable intervals
      const shouldShowLabel =
        i === 0 ||
        i === sortedData.length - 1 ||
        segmentWidth > 100 || // Wide segments get their own label
        i % Math.max(1, Math.floor(sortedData.length / 8)) === 0; // Every ~8th segment

      if (shouldShowLabel) {
        labels.push({
          time: formatDisplayTime(startTime),
          position: cumulativePos,
          date: i === 0 ? formatDisplayDate(startTime) : undefined,
        });
      }

      cumulativePos += segmentWidth;
    }

    return { timePositions: positions, visibleLabels: labels, segmentWidths };
  }, [sortedData, totalDuration, containerWidth]);

  // Scroll to end on mount
  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current!.scrollLeft = scrollRef.current!.scrollWidth;
      }, 100);
    }
  }, [sortedData.length]);

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

  // Calculate segment widths
  const segmentWidths = sortedData.map((segment) => {
    const duration = segment.durationSeconds || 0;
    const width = Math.max((duration / totalDuration) * containerWidth, 60);
    return width;
  });

  const totalWidth = segmentWidths.reduce((sum, width) => sum + width, 0);

  return (
    <div className="p-6 overflow-visible!">
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
              )
          )}
        </div>
      </div>

      <div ref={containerRef} className="mb-6  overflow-visible">
        <ScrollArea className="overflow-visible!" ref={scrollRef}>
          <div
            className="h-[370px] relative overflow-visible! pt-[130px]"
            style={{ width: `${totalWidth}px` }}>
            {/* Timeline header with date */}
            <div className="mb-2 text-sm font-medium text-gray-600">
              {sortedData.length > 0 &&
                formatDisplayDate(parsePKTTimestamp(sortedData[0].timestamp))}
            </div>

            {/* Timeline segments */}
            <div className="flex h-32 rounded-lg border border-gray-200 shadow-sm">
              {sortedData.map((segment, index) => {
                const duration = segment.durationSeconds || 0;
                const width = segmentWidths[index];
                const startTime = parsePKTTimestamp(segment.timestamp);
                const endTime = new Date(startTime.getTime() + duration * 1000);

                return (
                  <div
                    key={segment._id || index}
                    className={`relative group ${
                      STATUS_COLORS[segment.status] || STATUS_COLORS.UNKNOWN
                    } 
          cursor-pointer transition-all duration-200 hover:brightness-110`}
                    style={{
                      width: `${width}px`,
                      minWidth: "60px",
                      height: "64px",
                    }}
                    onMouseEnter={() => setHoveredSegment(index)}
                    onMouseLeave={() => setHoveredSegment(null)}>
                    {hoveredSegment === index && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 z-[9999]">
                        <div className="relative mb-2">
                          <div className="bg-gray-900 text-white text-xs rounded-lg shadow-xl p-3 whitespace-nowrap border border-gray-700 min-w-[180px]">
                            <div className="font-bold mb-2 text-sm">
                              {segment.machineName}
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className={`w-2 h-2 rounded-full ${
                                  STATUS_COLORS[segment.status]
                                }`}
                              />
                              <span className="font-medium">
                                {STATUS_LABELS[segment.status]}
                              </span>
                            </div>
                            <div className="space-y-1 text-gray-300">
                              <div className="flex justify-between">
                                <span>Start:</span>
                                <span>{formatDisplayTime(startTime)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>End:</span>
                                <span>{formatDisplayTime(endTime)}</span>
                              </div>
                              <div className="flex justify-between font-medium mt-2 pt-2 border-t border-gray-700">
                                <span>Duration:</span>
                                <span>{formatDuration(duration)}</span>
                              </div>
                            </div>
                          </div>
                          {/* Tooltip arrow */}
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
                        </div>
                      </div>
                    )}
                    {/* Duration label inside segment */}
                    {width > 20 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded bg-black/20 backdrop-blur-sm ${
                            segment.status === "RUNNING"
                              ? "text-white"
                              : segment.status === "DOWNTIME"
                              ? "text-gray-900"
                              : "text-white"
                          }`}>
                          {formatDuration(duration)}
                        </span>
                      </div>
                    )}
                    {/* Segment separator */}
                    {index < sortedData.length - 1 && (
                      <div className="absolute right-0 top-0 h-full w-px bg-gray-800/30" />
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
                    {/* Marker line */}
                    <div className="w-px h-3 bg-gray-300 mt-1" />
                  </div>
                </div>
              ))}

              {/* Add an end time label if not already included */}
              {sortedData.length > 0 &&
                !visibleLabels.some(
                  (l) =>
                    l.time ===
                    formatDisplayTime(
                      new Date(
                        parsePKTTimestamp(
                          sortedData[sortedData.length - 1].timestamp
                        ).getTime() +
                          (sortedData[sortedData.length - 1].durationSeconds ||
                            0) *
                            1000
                      )
                    )
                ) && (
                  <div
                    className="absolute text-xs text-gray-600"
                    style={{
                      left: `${totalWidth}px`,
                      transform: "translateX(-100%)",
                    }}>
                    <div className="flex flex-col items-center">
                      <div className="font-medium whitespace-nowrap">
                        {formatDisplayTime(
                          new Date(
                            parsePKTTimestamp(
                              sortedData[sortedData.length - 1].timestamp
                            ).getTime() +
                              (sortedData[sortedData.length - 1]
                                .durationSeconds || 0) *
                                1000
                          )
                        )}
                      </div>
                      <div className="w-px h-3 bg-gray-300 mt-1" />
                    </div>
                  </div>
                )}
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Summary stats - Improved layout */}
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
              0
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
    </div>
  );
}
