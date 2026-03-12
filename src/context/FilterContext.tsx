import { createContext, useContext, useState, useMemo, ReactNode } from "react";
import { getDateRangeForFilter } from "@/lib/analytics";
import { toLocalISOString } from "@/components/toLocalISOString";

export type TimeFilter = "shift" | "day" | "week" | "month" | "3months";
export type StatusFilter = "ALL" | "RUNNING" | "DOWNTIME" | "OFF";

export interface DateRange {
  from: string;
  to: string;
  realFrom: string;
}

interface FilterState {
  timeFilter: TimeFilter;
  setTimeFilter: (f: TimeFilter) => void;

  shiftFilter: string;
  setShiftFilter: (s: string) => void;

  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;

  customFrom: Date | null;
  customTo: Date | null;
  setCustomRange: (from: Date | null, to: Date | null) => void;

  dateRange: DateRange;

  resetAllFilters: () => void;
  showResetButton: boolean;

  /** Pre-formatted string for the filter badge — includes date AND time */
  customDateLabel: string | null;
}

const FilterContext = createContext<FilterState | null>(null);

// ── Format a Date as "Mar 10, 2026 07:00 AM" ─────────────────────────────
function formatWithTime(d: Date): string {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function FilterProvider({ children }: { children: ReactNode }) {
  const [timeFilter, setTimeFilterRaw] = useState<TimeFilter>("shift");
  const [shiftFilter, setShiftFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);

  const setTimeFilter = (f: TimeFilter) => {
    setTimeFilterRaw(f);
    setCustomFrom(null);
    setCustomTo(null);
  };

  const setCustomRange = (from: Date | null, to: Date | null) => {
    setCustomFrom(from);
    setCustomTo(to);
  };

  const resetAllFilters = () => {
    setTimeFilterRaw("shift");
    setShiftFilter("All");
    setStatusFilter("ALL");
    setCustomFrom(null);
    setCustomTo(null);
  };

  const showResetButton =
    timeFilter !== "shift" ||
    shiftFilter !== "All" ||
    customFrom !== null ||
    customTo !== null;

  const dateRange = useMemo<DateRange>(() => {
    if (customFrom && customTo) {
      const realFrom = toLocalISOString(customFrom);
      return {
        from: realFrom,
        to: toLocalISOString(customTo),
        realFrom,
      };
    }
    return getDateRangeForFilter(timeFilter);
  }, [customFrom, customTo, timeFilter]);

  // Label shown in the filter badge — "Mar 10 07:00 AM → Mar 11 07:00 AM"
  const customDateLabel = useMemo(() => {
    if (!customFrom || !customTo) return null;
    const fromStr = formatWithTime(customFrom);
    const toStr = formatWithTime(customTo);
    // If same calendar date, show "Mar 10, 2026  07:00 AM → 07:00 AM"
    if (customFrom.toDateString() === customTo.toDateString()) {
      const timeFrom = customFrom.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const timeTo = customTo.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const date = customFrom.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return `${date}  ${timeFrom} → ${timeTo}`;
    }
    return `${fromStr} → ${toStr}`;
  }, [customFrom, customTo]);

  return (
    <FilterContext.Provider
      value={{
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
      }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters(): FilterState {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilters must be used inside <FilterProvider>");
  return ctx;
}
