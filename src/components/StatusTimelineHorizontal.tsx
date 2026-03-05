import { Card } from "@/components/ui/card";
import { MachineData } from "@/lib/api";
import { useRef, useEffect, useState, useMemo } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { parsePKTTimestamp, formatDisplayDate, formatDisplayTime } from "@/lib/timeUtils";

interface StatusTimelineHorizontalProps {
  data: MachineData[];
  title?: string;
  machineName?: string;
}

const STATUS_COLORS = {
  RUNNING: "bg-success",
  DOWNTIME: "bg-warning",
  OFF: "bg-destructive",
  UNKNOWN: "bg-muted",
};

const STATUS_TEXT_COLORS = {
  RUNNING: "text-success",
  DOWNTIME: "text-warning",
  OFF: "text-destructive",
  UNKNOWN: "text-muted-foreground",
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

// Calculate pixel width based on duration
// Scale: 1 minute = 2px (base), with minimum width for visibility
function calculateSegmentWidth(durationSeconds: number, totalDuration: number, containerWidth: number): number {
  // For very long durations (more than 1 week), use proportional scaling
  if (totalDuration > 604800) { // 7 days in seconds
    const proportional = (durationSeconds / totalDuration) * Math.max(containerWidth * 3, 2000);
    return Math.max(proportional, 40);
  }
  
  // For medium durations (1 day to 1 week), use 1px per 30 seconds
  if (totalDuration > 86400) {
    const width = (durationSeconds / 30);
    return Math.max(width, 40);
  }
  
  // For shorter durations, use 1px per 10 seconds
  const width = (durationSeconds / 10);
  return Math.max(width, 40);
}

export function StatusTimelineHorizontal({
  data,
  title = "Status Timeline",
  machineName,
}: StatusTimelineHorizontalProps) {
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
          parsePKTTimestamp(a.timestamp).getTime() - parsePKTTimestamp(b.timestamp).getTime()
      ),
    [filteredData]
  );

  // Calculate total duration
  const totalDuration = useMemo(() => 
    sortedData.reduce((acc, d) => acc + (d.durationSeconds || 0), 0),
    [sortedData]
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

  // Calculate segment widths based on duration
  const segmentWidths = useMemo(() => 
    sortedData.map((segment) => {
      const duration = segment.durationSeconds || 0;
      return calculateSegmentWidth(duration, totalDuration, containerWidth);
    }),
    [sortedData, totalDuration, containerWidth]
  );

  const totalWidth = useMemo(() => 
    segmentWidths.reduce((sum, width) => sum + width, 0),
    [segmentWidths]
  );

  // Scroll to end on mount
  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current!.scrollLeft = scrollRef.current!.scrollWidth;
      }, 100);
    }
  }, [sortedData.length]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const stats = {
      RUNNING: { duration: 0, count: 0 },
      DOWNTIME: { duration: 0, count: 0 },
      OFF: { duration: 0, count: 0 },
    };

    sortedData.forEach((d) => {
      if (d.status in stats) {
        stats[d.status as keyof typeof stats].duration += d.durationSeconds || 0;
        stats[d.status as keyof typeof stats].count++;
      }
    });

    return stats;
  }, [sortedData]);

  if (sortedData.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">{title}</h3>
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          No data available for timeline
        </div>
      </Card>
    );
  }

  // Get date range for display - parse PKT timestamps
  const startDate = parsePKTTimestamp(sortedData[0].timestamp);
  const endDate = new Date(
    parsePKTTimestamp(sortedData[sortedData.length - 1].timestamp).getTime() +
    (sortedData[sortedData.length - 1].durationSeconds || 0) * 1000
  );

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold">{title}</h3>
          <p className="text-sm text-muted-foreground">
            {formatDisplayDate(startDate)} {formatDisplayTime(startDate)} → {formatDisplayDate(endDate)} {formatDisplayTime(endDate)}
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {Object.entries(STATUS_LABELS).map(([key, label]) =>
            key !== "UNKNOWN" && (
              <div key={key} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded ${STATUS_COLORS[key as keyof typeof STATUS_COLORS]}`} />
                <span className="text-muted-foreground">{label}</span>
              </div>
            )
          )}
        </div>
      </div>

      {/* Timeline container */}
      <div ref={containerRef} className="mb-6">
        <ScrollArea className="w-full whitespace-nowrap rounded-lg" ref={scrollRef}>
          <div className="relative pb-8" style={{ width: `${Math.max(totalWidth, containerWidth)}px` }}>
            {/* Timeline bar */}
            <div className="flex h-20 rounded-lg overflow-hidden border border-border shadow-sm">
              {sortedData.map((segment, index) => {
                const duration = segment.durationSeconds || 0;
                const width = segmentWidths[index];
                // Parse PKT timestamp from API
                const startTime = parsePKTTimestamp(segment.timestamp);
                const endTime = new Date(startTime.getTime() + duration * 1000);
                const isHovered = hoveredSegment === index;

                return (
                  <div
                    key={segment._id || index}
                    className={`relative group ${STATUS_COLORS[segment.status] || STATUS_COLORS.UNKNOWN} 
                      cursor-pointer transition-all duration-200 
                      ${isHovered ? "brightness-110 z-10" : "hover:brightness-105"}`}
                    style={{
                      width: `${width}px`,
                      minWidth: "40px",
                    }}
                    onMouseEnter={() => setHoveredSegment(index)}
                    onMouseLeave={() => setHoveredSegment(null)}
                  >
                    {/* Tooltip */}
                    {isHovered && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
                        <div className="bg-popover text-popover-foreground text-xs rounded-lg shadow-xl p-3 whitespace-nowrap border border-border min-w-[200px]">
                          <div className="font-bold mb-2 text-sm">{segment.machineName}</div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[segment.status]}`} />
                            <span className={`font-semibold ${STATUS_TEXT_COLORS[segment.status]}`}>
                              {STATUS_LABELS[segment.status]}
                            </span>
                          </div>
                          <div className="space-y-1.5 text-muted-foreground">
                            <div className="flex justify-between gap-4">
                              <span>Date:</span>
                              <span className="text-foreground">{formatDisplayDate(startTime)}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span>Start:</span>
                              <span className="text-foreground">{formatDisplayTime(startTime)}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span>End:</span>
                              <span className="text-foreground">{formatDisplayTime(endTime)}</span>
                            </div>
                            <div className="flex justify-between gap-4 font-medium mt-2 pt-2 border-t border-border">
                              <span>Duration:</span>
                              <span className="text-foreground">{formatDuration(duration)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Duration label inside segment - only show if wide enough */}
                    {width > 70 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-semibold px-2 py-1 rounded bg-background/20 backdrop-blur-sm text-white drop-shadow-md">
                          {formatDuration(duration)}
                        </span>
                      </div>
                    )}

                    {/* Segment separator */}
                    {index < sortedData.length - 1 && (
                      <div className="absolute right-0 top-0 h-full w-px bg-background/30" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Time markers below timeline */}
            <div className="relative mt-2 h-6">
              {/* Start time */}
              <div className="absolute left-0 text-xs text-muted-foreground flex flex-col items-start">
                <div className="w-px h-2 bg-border mb-1" />
                <span>{formatDisplayTime(startDate)}</span>
              </div>
              
              {/* End time */}
              <div className="absolute right-0 text-xs text-muted-foreground flex flex-col items-end">
                <div className="w-px h-2 bg-border mb-1" />
                <span>{formatDisplayTime(endDate)}</span>
              </div>
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        
        {/* Scroll hint */}
        <p className="text-xs text-muted-foreground text-center mt-2">
          ← Scroll horizontally to see full timeline →
        </p>
      </div>

      {/* Summary Statistics */}
      <div className="border-t border-border pt-6">
        <h4 className="text-sm font-semibold text-muted-foreground mb-4">Status Summary</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(["RUNNING", "DOWNTIME", "OFF"] as const).map((status) => {
            const stats = summaryStats[status];
            const percentage = totalDuration > 0 
              ? ((stats.duration / totalDuration) * 100).toFixed(1) 
              : "0.0";

            return (
              <div
                key={status}
                className="text-center p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className={`w-3 h-3 rounded ${STATUS_COLORS[status]}`} />
                  <span className={`text-sm font-semibold ${STATUS_TEXT_COLORS[status]}`}>
                    {STATUS_LABELS[status]}
                  </span>
                </div>
                <div className="text-2xl font-bold mb-1">
                  {formatDuration(stats.duration)}
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>{percentage}% of total</div>
                  <div>{stats.count} event{stats.count !== 1 ? "s" : ""}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total duration */}
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Total Duration: <span className="font-semibold text-foreground">{formatDuration(totalDuration)}</span>
          {" | "}
          Total Events: <span className="font-semibold text-foreground">{sortedData.length}</span>
        </div>
      </div>
    </Card>
  );
}
