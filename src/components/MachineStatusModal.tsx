import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "./StatusBadge";
import { DashboardOverview } from "@/lib/api";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { parsePKTTimestamp, formatDisplayDateTime } from "@/lib/timeUtils";

interface MachineStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: "RUNNING" | "DOWNTIME" | "OFF";
  machines: DashboardOverview[];
}

export function MachineStatusModal({
  isOpen,
  onClose,
  status,
  machines,
}: MachineStatusModalProps) {
  const filteredMachines = machines.filter((m) => m.latestStatus === status);

  const statusLabels = {
    RUNNING: "Running Machines",
    DOWNTIME: "Downtime Machines",
    OFF: "Off Machines",
  };

  const statusColors = {
    RUNNING: "text-success",
    DOWNTIME: "text-warning",
    OFF: "text-destructive",
  };

  // Sort machines numerically
  const sortedMachines = [...filteredMachines].sort((a, b) => {
    const numA = parseInt(a.machineName.replace(/\D/g, ""), 10);
    const numB = parseInt(b.machineName.replace(/\D/g, ""), 10);
    return numA - numB;
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className={`text-xl font-bold ${statusColors[status]}`}>
            {statusLabels[status]} ({filteredMachines.length})
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 max-h-[60vh] overflow-y-auto">
          {sortedMachines.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No machines with {status.toLowerCase()} status
            </p>
          ) : (
            <ul className="space-y-2">
              {sortedMachines.map((machine) => {
                // Parse PKT timestamp from API (already in PKT, not UTC)
                const lastUpdate = machine.lastTimestamp
                  ? formatDisplayDateTime(parsePKTTimestamp(machine.lastTimestamp))
                  : "N/A";

                return (
                  <li
                    key={machine.machineName}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <StatusBadge status={status} />
                      <div>
                        <span className="font-medium">{machine.machineName}</span>
                        <p className="text-xs text-muted-foreground">
                          Last: {lastUpdate}
                        </p>
                      </div>
                    </div>
                    <Link to={`/machine/${machine.machineName}`}>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
