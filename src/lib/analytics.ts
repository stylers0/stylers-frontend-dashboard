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
// Date-range helpers
// ─────────────────────────────────────────────────────────────────────────────
import {
  currentPKTHour,
  pktHourToUTCIso,
  utcNow,
  PKT_OFFSET_MS,
} from "./timeUtils";

// How far before the shift start we fetch, to catch in-progress events
// that started before the shift boundary. 2 hours is generous enough
// to cover any realistic long-running event.
const SHIFT_PREFETCH_BUFFER_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Returns the current shift's REAL boundaries as UTC ISO strings.
 * Used for clipping — these are the true shift start/end, not the
 * buffered fetch window.
 */
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

export function getDateRangeForFilter(
  filter: "shift" | "day" | "week" | "month" | "3months",
): { from: string; to: string } {
  if (filter === "shift") {
    // Fetch EARLIER than the real shift start so we catch any event that
    // started before the boundary but was still running when the shift began.
    // clipDataToShiftWindow() will trim those records on the frontend.
    const { from, to } = getCurrentShiftBoundaries();
    const bufferedFrom = new Date(
      new Date(from).getTime() - SHIFT_PREFETCH_BUFFER_MS,
    ).toISOString();
    return { from: bufferedFrom, to };
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

// ─────────────────────────────────────────────────────────────────────────────
// Shift window clipping
//
// When filter === "shift", we fetched records from up to 2 hours BEFORE the
// real shift start. Any record that started before shiftStartMs but ended
// after it needs its timestamp and durationSeconds adjusted so only the
// portion WITHIN the shift window is counted.
//
// Example:
//   Shift starts 15:00 PKT (10:00 UTC)
//   Record: RUNNING from 09:51 UTC, duration 1141s (ends 10:10 UTC)
//   → Clipped: timestamp = 10:00 UTC, duration = 600s (10:00→10:10)
//
// Records that ended entirely before shiftStartMs are dropped.
// Records that start at or after shiftStartMs are kept as-is.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clip machineData to only include time within the current shift window.
 * Call this on the raw data from the API when timeFilter === "shift",
 * before passing data to any analytics or display components.
 *
 * @param data          Raw MachineData[] from fetchMachineData
 * @param shiftFrom     Real shift start as UTC ISO string (from getCurrentShiftBoundaries)
 * @param shiftTo       Real shift end as UTC ISO string
 */
export function clipDataToShiftWindow(
  data: MachineData[],
  shiftFrom: string,
  shiftTo: string,
): MachineData[] {
  const shiftStartMs = new Date(shiftFrom).getTime();
  const shiftEndMs = new Date(shiftTo).getTime();

  const result: MachineData[] = [];

  for (const record of data) {
    const recStartMs = new Date(record.timestamp).getTime();
    const recDuration = record.durationSeconds || 0;
    const recEndMs = recStartMs + recDuration * 1000;

    // Record ends before shift start → discard entirely
    if (recEndMs <= shiftStartMs) continue;

    // Record starts at or after shift start → keep as-is
    if (recStartMs >= shiftStartMs) {
      result.push(record);
      continue;
    }

    // Record straddles the shift start boundary → clip it
    // New start = shift start, new duration = time from shift start to record end
    const clippedStartMs = shiftStartMs;
    const clippedDuration = Math.max(0, (recEndMs - clippedStartMs) / 1000);

    if (clippedDuration <= 0) continue;

    result.push({
      ...record,
      // Overwrite timestamp with the shift start (as UTC ISO string)
      timestamp: new Date(clippedStartMs).toISOString(),
      durationSeconds: Math.round(clippedDuration),
    });
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
