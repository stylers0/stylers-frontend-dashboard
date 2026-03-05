import { MachineData } from "./api";

export interface MachineAnalytics {
  totalRecords: number;
  runningTime: number;
  downtimeTime: number;
  offTime: number;
  runningPercentage: number;
  downtimePercentage: number;
  offPercentage: number;
  utilizationPercentage: number; // RUNNING / (RUNNING + DOWNTIME) - excludes OFF
  efficiencyPercentage: number;  // Same as utilization - for display
  longestRunDuration: number;
  numberOfOffs: number;
  averageOffDuration: number;
  averageDowntimeDuration: number;
  statusCounts: {
    RUNNING: number;
    DOWNTIME: number;
    OFF: number;
  };
}

export function calculateMachineAnalytics(
  data: MachineData[]
): MachineAnalytics {
  if (!data || data.length === 0) {
    return {
      totalRecords: 0,
      runningTime: 0,
      downtimeTime: 0,
      offTime: 0,
      runningPercentage: 0,
      downtimePercentage: 0,
      offPercentage: 0,
      utilizationPercentage: 0,
      efficiencyPercentage: 0,
      longestRunDuration: 0,
      numberOfOffs: 0,
      averageOffDuration: 0,
      averageDowntimeDuration: 0,
      statusCounts: { RUNNING: 0, DOWNTIME: 0, OFF: 0 },
    };
  }

  let runningTime = 0;
  let downtimeTime = 0;
  let offTime = 0;
  let longestRunDuration = 0;
  let currentRunDuration = 0;
  let numberOfOffs = 0;
  let offDurations: number[] = [];
  let downtimeDurations: number[] = [];
  let lastStatus = "";

  const statusCounts = {
    RUNNING: 0,
    DOWNTIME: 0,
    OFF: 0,
  };

  data.forEach((record) => {
    const duration = record.durationSeconds || 0;

    // Count statuses
    if (record.status === "RUNNING") {
      statusCounts.RUNNING++;
      runningTime += duration;
      currentRunDuration += duration;
      longestRunDuration = Math.max(longestRunDuration, currentRunDuration);
    } else if (record.status === "DOWNTIME") {
      statusCounts.DOWNTIME++;
      downtimeTime += duration;
      downtimeDurations.push(duration);
      currentRunDuration = 0;
    } else if (record.status === "OFF") {
      statusCounts.OFF++;
      offTime += duration;
      offDurations.push(duration);
      currentRunDuration = 0;

      // Count transitions to OFF
      if (lastStatus !== "OFF" && lastStatus !== "") {
        numberOfOffs++;
      }
    }

    lastStatus = record.status;
  });

  const totalTime = runningTime + downtimeTime + offTime;

  // Percentages based on total time (including OFF)
  const runningPercentage = totalTime > 0 ? (runningTime / totalTime) * 100 : 0;
  const downtimePercentage = totalTime > 0 ? (downtimeTime / totalTime) * 100 : 0;
  const offPercentage = totalTime > 0 ? (offTime / totalTime) * 100 : 0;

  // EFFICIENCY/UTILIZATION = Running / (Running + Downtime) - EXCLUDES OFF time
  const activeTime = runningTime + downtimeTime;
  const utilizationPercentage = activeTime > 0 ? (runningTime / activeTime) * 100 : 0;
  const efficiencyPercentage = utilizationPercentage; // Same calculation

  const averageOffDuration =
    offDurations.length > 0
      ? offDurations.reduce((a, b) => a + b, 0) / offDurations.length
      : 0;

  const averageDowntimeDuration =
    downtimeDurations.length > 0
      ? downtimeDurations.reduce((a, b) => a + b, 0) / downtimeDurations.length
      : 0;

  return {
    totalRecords: data.length,
    runningTime,
    downtimeTime,
    offTime,
    runningPercentage,
    downtimePercentage,
    offPercentage,
    utilizationPercentage,
    efficiencyPercentage,
    longestRunDuration,
    numberOfOffs,
    averageOffDuration,
    averageDowntimeDuration,
    statusCounts,
  };
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0s";
  
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}m ${secs}s`;
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  } else {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// Date-range helpers — all UTC-first, no browser timezone dependency
// Returns { from, to } as real UTC ISO strings that go straight to api.ts
// ─────────────────────────────────────────────────────────────────────────────
import {
  currentPKTHour,
  pktHourToUTCIso,
  utcNow,
  PKT_OFFSET_MS,
} from "./timeUtils";

/**
 * Build the shift time range for the CURRENT shift in PKT.
 * Returns UTC ISO strings — no timezone conversion needed downstream.
 *
 * Shifts (PKT hours):
 *   Morning : 07:00 – 15:00
 *   Evening : 15:00 – 23:00
 *   Night   : 23:00 – 07:00 (spans midnight)
 */
function getCurrentShiftRangeUTC(): { from: string; to: string } {
  const pktHour = currentPKTHour();

  if (pktHour >= 7 && pktHour < 15) {
    return {
      from: pktHourToUTCIso(7,  0),
      to:   pktHourToUTCIso(15, 0),
    };
  }

  if (pktHour >= 15 && pktHour < 23) {
    return {
      from: pktHourToUTCIso(15, 0),
      to:   pktHourToUTCIso(23, 0),
    };
  }

  // Night shift (23:00 – 07:00)
  if (pktHour < 7) {
    // Early morning portion — shift started yesterday PKT at 23:00
    return {
      from: pktHourToUTCIso(23, -1),  // yesterday PKT 23:00
      to:   pktHourToUTCIso(7,   0),  // today PKT 07:00
    };
  }

  // pktHour >= 23 — shift just started, ends tomorrow PKT 07:00
  return {
    from: pktHourToUTCIso(23, 0),
    to:   pktHourToUTCIso(7,  1),
  };
}

/**
 * Returns { from, to } as UTC ISO strings for the requested filter.
 * api.ts passes these directly to Supabase — no further conversion needed.
 */
export function getDateRangeForFilter(
  filter: "shift" | "day" | "week" | "month" | "3months",
): { from: string; to: string } {
  if (filter === "shift") {
    return getCurrentShiftRangeUTC();
  }

  const now = utcNow();
  const to = new Date(now).toISOString();
  let fromMs = now;

  switch (filter) {
    case "day":
      fromMs = now - 24 * 3600_000;
      break;
    case "week":
      fromMs = now - 7 * 86400_000;
      break;
    case "month": {
      const d = new Date(now);
      d.setUTCMonth(d.getUTCMonth() - 1);
      fromMs = d.getTime();
      break;
    }
    case "3months": {
      const d = new Date(now);
      d.setUTCMonth(d.getUTCMonth() - 3);
      fromMs = d.getTime();
      break;
    }
    default:
      fromMs = now - 24 * 3600_000;
  }

  return { from: new Date(fromMs).toISOString(), to };
}
