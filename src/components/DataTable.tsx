import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { MachineData } from "@/lib/api";
import { formatDuration } from "@/lib/analytics";
import {
  parsePKTTimestamp,
  formatDisplayDate,
  formatDisplayTimeWithSeconds,
} from "@/lib/timeUtils";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DataTableProps {
  data: MachineData[];
  title?: string;
  maxRows?: number;
  statusFilter?: "ALL" | "RUNNING" | "DOWNTIME" | "OFF";
  isLoading?: boolean;
  pageSize?: number;
}

export function DataTable({
  data,
  title = "Recent Data",
  maxRows = 10000,
  statusFilter = "ALL",
  isLoading = false,
  pageSize: initialPageSize = 50,
}: DataTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Filter data by status
  const filteredData = useMemo(() => {
    const filtered =
      statusFilter === "ALL"
        ? data
        : data.filter((d) => d.status === statusFilter);
    return filtered.slice(0, maxRows);
  }, [data, statusFilter, maxRows]);

  // Reset to page 1 when filter or data changes
  useMemo(() => {
    setCurrentPage(1);
  }, [statusFilter, data]);

  const totalRecords = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const displayData = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, safeCurrentPage, pageSize]);

  const startRecord =
    totalRecords === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endRecord = Math.min(safeCurrentPage * pageSize, totalRecords);

  if (filteredData.length === 0) {
    return (
      <Card className="overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="text-lg font-bold">{title}</h3>
        </div>
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          No data available for the selected filters.
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold">{title}</h3>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            {totalRecords.toLocaleString()} records
          </span>
        </div>
        {isLoading && (
          <span className="text-xs text-muted-foreground animate-pulse">
            Updating...
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time Range</TableHead>
              <TableHead>Machine</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayData.map((record) => {
              const startTime = parsePKTTimestamp(record.timestamp);
              const endTime =
                record.durationSeconds > 0
                  ? new Date(
                      startTime.getTime() + record.durationSeconds * 1000,
                    )
                  : null;

              const startDateStr = formatDisplayDate(startTime);
              const startTimeStr = formatDisplayTimeWithSeconds(startTime);
              const endTimeStr = endTime
                ? formatDisplayTimeWithSeconds(endTime)
                : null;

              return (
                <TableRow
                  key={record._id}
                  className={`${
                    record.status === "RUNNING"
                      ? "bg-green-100/70 dark:bg-green-900/20"
                      : record.status === "DOWNTIME"
                        ? "bg-yellow-50/70 dark:bg-yellow-900/20"
                        : record.status === "OFF"
                          ? "bg-red-50/50 dark:bg-red-900/10"
                          : "bg-background"
                  }`}>
                  <TableCell className="font-mono text-xs">
                    <span>{startDateStr}, </span>
                    <span className="font-bold">
                      {startTimeStr}
                      {endTimeStr ? ` → ${endTimeStr}` : ""}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">
                    {record.machineName}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={record.status} />
                  </TableCell>
                  <TableCell>
                    {record.durationSeconds > 0
                      ? formatDuration(record.durationSeconds)
                      : "-"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3 bg-secondary/20">
        {/* Left: rows info + page size selector */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            Showing{" "}
            <span className="font-medium text-foreground">{startRecord}</span>–
            <span className="font-medium text-foreground">{endRecord}</span> of{" "}
            <span className="font-medium text-foreground">
              {totalRecords.toLocaleString()}
            </span>
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs">Rows:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                setPageSize(Number(val));
                setCurrentPage(1);
              }}>
              <SelectTrigger className="h-7 w-[70px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[25, 50, 100, 200].map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-xs">
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Right: page navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentPage(1)}
            disabled={safeCurrentPage === 1}>
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safeCurrentPage === 1}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          {/* Page number pills */}
          <div className="flex items-center gap-1">
            {(() => {
              const pages: (number | "...")[] = [];
              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                pages.push(1);
                if (safeCurrentPage > 3) pages.push("...");
                for (
                  let i = Math.max(2, safeCurrentPage - 1);
                  i <= Math.min(totalPages - 1, safeCurrentPage + 1);
                  i++
                ) {
                  pages.push(i);
                }
                if (safeCurrentPage < totalPages - 2) pages.push("...");
                pages.push(totalPages);
              }

              return pages.map((p, idx) =>
                p === "..." ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-1 text-xs text-muted-foreground">
                    …
                  </span>
                ) : (
                  <Button
                    key={p}
                    variant={safeCurrentPage === p ? "default" : "outline"}
                    size="icon"
                    className="h-7 w-7 text-xs"
                    onClick={() => setCurrentPage(p as number)}>
                    {p}
                  </Button>
                ),
              );
            })()}
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safeCurrentPage === totalPages}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentPage(totalPages)}
            disabled={safeCurrentPage === totalPages}>
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
