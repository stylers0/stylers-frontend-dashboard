import { useEffect, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, RefreshCw, CalendarIcon, X, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FilterBarProps {
  timeFilter: "shift" | "day" | "week" | "month" | "3months";
  onTimeFilterChange: (
    value: "shift" | "day" | "week" | "month" | "3months",
  ) => void;
  onCustomDateChange?: (from: Date | null, to: Date | null) => void;
  // Pass the currently active custom dates from context so FilterBar
  // can restore its internal inputs when it remounts after navigation
  currentCustomFrom?: Date | null;
  currentCustomTo?: Date | null;
  shiftFilter?: string;
  onShiftFilterChange?: (value: string) => void;
  onExport?: () => void;
  onRefresh?: () => void;
  onResetFilters?: () => void;
  showShiftFilter?: boolean;
  showResetButton?: boolean;
  currentFilters?: {
    timeRange: string;
    shift?: string;
    customDate?: string;
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────
function dateToInputValue(d: Date): string {
  // Returns "YYYY-MM-DD" for the calendar
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function timeFromDate(d: Date): string {
  // Returns "HH:MM" for the time input
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function FilterBar({
  timeFilter,
  onTimeFilterChange,
  onCustomDateChange,
  currentCustomFrom,
  currentCustomTo,
  shiftFilter = "All",
  onShiftFilterChange,
  onExport,
  onRefresh,
  onResetFilters,
  showShiftFilter = false,
  showResetButton = false,
  currentFilters,
}: FilterBarProps) {
  const [customRangeOpen, setCustomRangeOpen] = useState(false);

  // ── Initialise from context values so state survives navigation ──────────
  const [startDate, setStartDate] = useState<Date>(() => {
    if (currentCustomFrom) return currentCustomFrom;
    const d = new Date();
    d.setHours(7, 0, 0, 0);
    return d;
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    if (currentCustomTo) return currentCustomTo;
    const d = new Date();
    d.setHours(7, 0, 0, 0);
    return d;
  });
  const [startTime, setStartTime] = useState<string>(() =>
    currentCustomFrom ? timeFromDate(currentCustomFrom) : "07:00",
  );
  const [endTime, setEndTime] = useState<string>(() =>
    currentCustomTo ? timeFromDate(currentCustomTo) : "07:00",
  );

  // When context custom dates change externally (e.g. reset), sync inputs
  useEffect(() => {
    if (currentCustomFrom) {
      setStartDate(currentCustomFrom);
      setStartTime(timeFromDate(currentCustomFrom));
    }
    if (currentCustomTo) {
      setEndDate(currentCustomTo);
      setEndTime(timeFromDate(currentCustomTo));
    }
    // If both are cleared (reset), go back to defaults
    if (!currentCustomFrom && !currentCustomTo) {
      const d = new Date();
      d.setHours(7, 0, 0, 0);
      setStartDate(d);
      setEndDate(new Date(d));
      setStartTime("07:00");
      setEndTime("07:00");
    }
  }, [currentCustomFrom, currentCustomTo]);

  const handleApplyCustom = () => {
    if (startDate && endDate) {
      const [startHours, startMinutes] = startTime.split(":").map(Number);
      const [endHours, endMinutes] = endTime.split(":").map(Number);

      const fromDate = new Date(startDate);
      fromDate.setHours(startHours, startMinutes, 0, 0);

      const toDate = new Date(endDate);
      toDate.setHours(endHours, endMinutes, 59, 999);

      onCustomDateChange?.(fromDate, toDate);
      setCustomRangeOpen(false);
    }
  };

  const handleResetFilters = () => {
    onTimeFilterChange?.("shift");
    onShiftFilterChange?.("All");
    onCustomDateChange?.(null, null);
    onResetFilters?.();
  };

  // Only reset local inputs when timeFilter changes AND there's no active
  // custom range in context — prevents clearing on navigation back
  useEffect(() => {
    if (!currentCustomFrom && !currentCustomTo) {
      const d = new Date();
      d.setHours(7, 0, 0, 0);
      setStartDate(d);
      setEndDate(new Date(d));
      setStartTime("07:00");
      setEndTime("07:00");
    }
  }, [timeFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Time Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Time Range:
          </span>
          <Select value={timeFilter} onValueChange={onTimeFilterChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="shift">Current Shift</SelectItem>
              <SelectItem value="day">Last 24 Hours</SelectItem>
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="month">Last Month</SelectItem>
              <SelectItem value="3months">Last 3 Months</SelectItem>
            </SelectContent>
          </Select>

          {/* Custom Date Modal */}
          <Dialog open={customRangeOpen} onOpenChange={setCustomRangeOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="ml-2">
                <CalendarIcon className="w-4 h-4 mr-1" />
                Custom Date
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card p-6 rounded-2xl shadow-lg">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-foreground">
                  Select Date & Time Range
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  Choose the date and time range for filtering the machine data.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {/* From Date */}
                <div className="flex flex-col gap-2 p-3 border rounded-lg">
                  <Label className="text-sm font-medium">From Date</Label>
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      if (date) {
                        setStartDate(date);
                        if (endDate && date > endDate) setEndDate(date);
                      }
                    }}
                    disabled={(date) => date > new Date()}
                    className="rounded-md border pointer-events-auto"
                  />
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Time:</Label>
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-32"
                    />
                  </div>
                </div>

                {/* To Date */}
                <div className="flex flex-col gap-2 p-3 border rounded-lg">
                  <Label className="text-sm font-medium">To Date</Label>
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      if (date) setEndDate(date);
                    }}
                    disabled={(date) => date > new Date() || date < startDate}
                    className="rounded-md border pointer-events-auto"
                  />
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Time:</Label>
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-32"
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={handleApplyCustom}
                className="w-full mt-4 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition rounded-xl py-2">
                Apply
              </Button>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {showResetButton && onResetFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="text-destructive hover:text-destructive hover:text-white hover:border-white">
              <X className="w-4 h-4" />
              Reset Filters
            </Button>
          )}
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          )}
          {onExport && (
            <Button variant="default" size="sm" onClick={onExport}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Active filter badge */}
      {currentFilters && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-lg">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            Active Filter:
          </span>
          {!currentFilters.customDate ? (
            <Badge variant="secondary" className="gap-1">
              <span className="font-medium">Time:</span>{" "}
              {currentFilters.timeRange}
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <span className="font-medium">Custom:</span>{" "}
              {currentFilters.customDate}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
