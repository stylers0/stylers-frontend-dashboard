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
import { Badge } from "@/components/ui/badge"; // Add this import

interface FilterBarProps {
  timeFilter: "shift" | "day" | "week" | "month" | "3months";
  onTimeFilterChange: (
    value: "shift" | "day" | "week" | "month" | "3months",
  ) => void;
  onCustomDateChange?: (from: Date | null, to: Date | null) => void;
  shiftFilter?: string;
  onShiftFilterChange?: (value: string) => void;
  onExport?: () => void;
  onRefresh?: () => void;
  onResetFilters?: () => void; // Add this prop
  showShiftFilter?: boolean;
  showResetButton?: boolean; // Add this prop
  currentFilters?: {
    // Add this prop for displaying current filters
    timeRange: string;
    shift?: string;
    customDate?: string;
  };
}

export function FilterBar({
  timeFilter,
  onTimeFilterChange,
  onCustomDateChange,
  shiftFilter = "All",
  onShiftFilterChange,
  onExport,
  onRefresh,
  onResetFilters, // Add this
  showShiftFilter = false,
  showResetButton = false, // Add this
  currentFilters, // Add this
}: FilterBarProps) {
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("23:59");

  const handleApplyCustom = () => {
    if (startDate && endDate) {
      // Combine date and time
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
    // Reset to default filters
    onTimeFilterChange?.("shift");
    if (onShiftFilterChange) {
      onShiftFilterChange?.("All");
    }
    onCustomDateChange?.(null, null);
    if (onResetFilters) {
      onResetFilters();
    }
  };

  // Reset custom dates whenever timeFilter changes
  useEffect(() => {
    setStartDate(new Date());
    setEndDate(new Date());
    setStartTime("00:00");
    setEndTime("23:59");
    onCustomDateChange?.(null, null);
  }, [timeFilter]);

  return (
    <div className="space-y-4">
      {/* Current Filters Badge */}

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

              {/* Action Button */}
              <Button
                onClick={handleApplyCustom}
                className="w-full mt-4 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition rounded-xl py-2">
                Apply
              </Button>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Reset Filters Button */}
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
      {currentFilters && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-lg">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            Current Filters:
          </span>
          {!currentFilters.customDate && (
            <Badge variant="secondary" className="gap-1">
              <span className="font-medium">Time:</span>{" "}
              {currentFilters.timeRange}
            </Badge>
          )}

          {currentFilters.customDate && (
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
