import { MachineData } from "./api";

export interface MachineAnalytics {
  totalRecords: number;
  runningTime: number;
  downtimeTime: number;
  offTime: number;
  runningPercentage: number;
  downtimePercentage: number;
  offPercentage: number;
  utilizationPercentage: number;
  efficiencyPercentage: number;
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
  data: MachineData[],
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

  const statusCounts = { RUNNING: 0, DOWNTIME: 0, OFF: 0 };

  data.forEach((record) => {
    const duration = record.durationSeconds || 0;

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
      if (lastStatus !== "OFF" && lastStatus !== "") numberOfOffs++;
    }

    lastStatus = record.status;
  });

  const totalTime = runningTime + downtimeTime + offTime;
  const runningPercentage = totalTime > 0 ? (runningTime / totalTime) * 100 : 0;
  const downtimePercentage =
    totalTime > 0 ? (downtimeTime / totalTime) * 100 : 0;
  const offPercentage = totalTime > 0 ? (offTime / totalTime) * 100 : 0;
  const activeTime = runningTime + downtimeTime;
  const utilizationPercentage =
    activeTime > 0 ? (runningTime / activeTime) * 100 : 0;
  const efficiencyPercentage = utilizationPercentage;

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
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}m ${secs}s`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return `${days}d ${hours}h`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Timezone helpers
// ─────────────────────────────────────────────────────────────────────────────
import {
  currentPKTHour,
  pktHourToUTCIso,
  utcNow,
  PKT_OFFSET_MS,
} from "./timeUtils";

// How far before any window start we fetch from Supabase.
// This ensures we always catch the in-progress event that was already running
// when the window opened. clipDataToShiftWindow then trims it to the exact
// window boundary so analytics and display are always accurate.
const PREFETCH_BUFFER_MS = 2 * 60 * 60 * 1000; // 2 hours

// ─────────────────────────────────────────────────────────────────────────────
// getCurrentShiftBoundaries
// Returns the REAL (unbuffered) shift start/end as UTC ISO strings.
// ─────────────────────────────────────────────────────────────────────────────
export function getCurrentShiftBoundaries(): { from: string; to: string } {
  const pktHour = currentPKTHour();
  if (pktHour >= 7 && pktHour < 15) {
    return { from: pktHourToUTCIso(7, 0), to: pktHourToUTCIso(15, 0) };
  }
  if (pktHour >= 15 && pktHour < 23) {
    return { from: pktHourToUTCIso(15, 0), to: pktHourToUTCIso(23, 0) };
  }
  if (pktHour < 7) {
    return { from: pktHourToUTCIso(23, -1), to: pktHourToUTCIso(7, 0) };
  }
  return { from: pktHourToUTCIso(23, 0), to: pktHourToUTCIso(7, 1) };
}

// ─────────────────────────────────────────────────────────────────────────────
// getDateRangeForFilter
//
// Returns { from, to } for the Supabase query.
// ALL filters now include a 2-hour prefetch buffer BEFORE the real window start
// so that any event already in progress when the window opened is fetched.
// clipDataToShiftWindow() trims those records to the exact window boundary.
//
// Example — "Last 24 Hours" at 10:20 AM:
//   Real window:     yesterday 10:20 AM  →  now
//   Fetched window:  yesterday 08:20 AM  →  now   (2h buffer)
//   After clipping:  yesterday 10:20 AM  →  now   ✓ exact
// ─────────────────────────────────────────────────────────────────────────────
export function getDateRangeForFilter(
  filter: "shift" | "day" | "week" | "month" | "3months",
): { from: string; to: string; realFrom: string } {
  const now = utcNow();
  // Subtract 1 minute so the end boundary shows e.g. 4:00 instead of 4:01
  const to = new Date(now - 60_000).toISOString();

  let realFromMs: number;

  if (filter === "shift") {
    const { from: shiftFrom } = getCurrentShiftBoundaries();
    realFromMs = new Date(shiftFrom).getTime();
  } else {
    switch (filter) {
      case "day":
        realFromMs = now - 24 * 3600_000;
        break;
      case "week":
        realFromMs = now - 7 * 86400_000;
        break;
      case "month": {
        const d = new Date(now);
        d.setUTCMonth(d.getUTCMonth() - 1);
        realFromMs = d.getTime();
        break;
      }
      case "3months": {
        const d = new Date(now);
        d.setUTCMonth(d.getUTCMonth() - 3);
        realFromMs = d.getTime();
        break;
      }
      default:
        realFromMs = now - 24 * 3600_000;
    }
  }

  // Buffered fetch start — always 2h before the real window
  const bufferedFrom = new Date(realFromMs - PREFETCH_BUFFER_MS).toISOString();
  const realFrom = new Date(realFromMs).toISOString();

  return { from: bufferedFrom, to, realFrom };
}

// ─────────────────────────────────────────────────────────────────────────────
// clipDataToShiftWindow
//
// Trims records to a specific [windowFrom, windowTo] time range.
// Any record that started BEFORE windowFrom but ended AFTER it gets:
//   - its timestamp set to windowFrom
//   - its durationSeconds reduced to only the portion inside the window
// Records that ended before windowFrom are dropped entirely.
// Records fully inside the window are kept as-is.
//
// This is called after every fetch, using realFrom (not the buffered from)
// as windowFrom, so the displayed data always starts exactly at the
// requested window boundary regardless of what was fetched from Supabase.
// ─────────────────────────────────────────────────────────────────────────────
export function clipDataToShiftWindow(
  data: MachineData[],
  windowFrom: string,
  windowTo: string,
): MachineData[] {
  const windowStartMs = new Date(windowFrom).getTime();
  const windowEndMs = new Date(windowTo).getTime();
  const result: MachineData[] = [];

  for (const record of data) {
    const recStartMs = new Date(record.timestamp).getTime();
    const recDuration = record.durationSeconds || 0;
    const recEndMs = recStartMs + recDuration * 1000;

    // Entirely outside window → drop
    if (recEndMs <= windowStartMs) continue;
    if (recStartMs >= windowEndMs) continue;

    // Clamp both start and end to the window
    const clampedStartMs = Math.max(recStartMs, windowStartMs);
    const clampedEndMs = Math.min(recEndMs, windowEndMs);
    const clampedDuration = Math.round((clampedEndMs - clampedStartMs) / 1000);

    if (clampedDuration <= 0) continue;

    // Only create a new object if we actually changed something
    if (clampedStartMs === recStartMs && clampedDuration === recDuration) {
      result.push(record);
    } else {
      result.push({
        ...record,
        timestamp: new Date(clampedStartMs).toISOString(),
        durationSeconds: clampedDuration,
      });
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shift-boundary splitting
// ─────────────────────────────────────────────────────────────────────────────
type ShiftName = "Morning" | "Evening" | "Night";

function shiftForPKTHour(pktHour: number): ShiftName {
  if (pktHour >= 7 && pktHour < 15) return "Morning";
  if (pktHour >= 15 && pktHour < 23) return "Evening";
  return "Night";
}

function nextShiftBoundaryUtcMs(
  cursorUtcMs: number,
  boundaryPKTHour: number,
): number {
  const pktDate = new Date(cursorUtcMs + PKT_OFFSET_MS);
  let boundaryUtcMs =
    Date.UTC(
      pktDate.getUTCFullYear(),
      pktDate.getUTCMonth(),
      pktDate.getUTCDate(),
      boundaryPKTHour,
      0,
      0,
      0,
    ) - PKT_OFFSET_MS;

  if (boundaryUtcMs <= cursorUtcMs) {
    boundaryUtcMs += 24 * 60 * 60 * 1000;
  }
  return boundaryUtcMs;
}

export function splitDurationByShift(
  startUtcMs: number,
  durationSeconds: number,
): Record<ShiftName, number> {
  const result: Record<ShiftName, number> = {
    Morning: 0,
    Evening: 0,
    Night: 0,
  };
  let remainingMs = durationSeconds * 1000;
  let cursorMs = startUtcMs;
  let safety = 0;

  while (remainingMs > 0 && safety < 8) {
    safety++;
    const pktHour = new Date(cursorMs + PKT_OFFSET_MS).getUTCHours();
    const shift = shiftForPKTHour(pktHour);
    const boundaryPKTHour =
      shift === "Morning" ? 15 : shift === "Evening" ? 23 : 7;

    const boundaryMs = nextShiftBoundaryUtcMs(cursorMs, boundaryPKTHour);
    const msInThisShift = Math.min(remainingMs, boundaryMs - cursorMs);
    result[shift] += msInThisShift / 1000;
    cursorMs += msInThisShift;
    remainingMs -= msInThisShift;
  }

  return result;
}

export interface ShiftBucket {
  runningTime: number;
  downtimeTime: number;
  offTime: number;
  runningPercentage: number;
  downtimePercentage: number;
  offPercentage: number;
  efficiencyPercentage: number;
}

export function calculateShiftAwareAnalytics(
  data: MachineData[],
): Record<ShiftName, ShiftBucket> {
  const buckets: Record<
    ShiftName,
    { running: number; downtime: number; off: number }
  > = {
    Morning: { running: 0, downtime: 0, off: 0 },
    Evening: { running: 0, downtime: 0, off: 0 },
    Night: { running: 0, downtime: 0, off: 0 },
  };

  for (const record of data) {
    if (!record.timestamp || !record.durationSeconds) continue;
    const startUtcMs = new Date(record.timestamp).getTime();
    if (isNaN(startUtcMs) || record.durationSeconds <= 0) continue;

    const split = splitDurationByShift(startUtcMs, record.durationSeconds);

    for (const shiftName of ["Morning", "Evening", "Night"] as ShiftName[]) {
      const seconds = split[shiftName];
      if (seconds <= 0) continue;
      if (record.status === "RUNNING") buckets[shiftName].running += seconds;
      if (record.status === "DOWNTIME") buckets[shiftName].downtime += seconds;
      if (record.status === "OFF") buckets[shiftName].off += seconds;
    }
  }

  const result = {} as Record<ShiftName, ShiftBucket>;
  for (const shiftName of ["Morning", "Evening", "Night"] as ShiftName[]) {
    const { running, downtime, off } = buckets[shiftName];
    const total = running + downtime + off;
    const active = running + downtime;
    result[shiftName] = {
      runningTime: running,
      downtimeTime: downtime,
      offTime: off,
      runningPercentage: total > 0 ? (running / total) * 100 : 0,
      downtimePercentage: total > 0 ? (downtime / total) * 100 : 0,
      offPercentage: total > 0 ? (off / total) * 100 : 0,
      efficiencyPercentage: active > 0 ? (running / active) * 100 : 0,
    };
  }
  return result;
}
