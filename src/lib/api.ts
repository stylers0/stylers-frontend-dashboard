// ─────────────────────────────────────────────────────────────────────────────
// api.ts  —  All data access via Supabase
// Timezone rule: Supabase stores UTC. PKT = UTC+5. We convert both ways here.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from "./supabase";

// ── Types ──────────────────────────────────────────────────────────────────

export interface MachineDataFilters {
  machine?: string;
  /** PKT local ISO string e.g. "2026-03-03T07:00:00" */
  from?: string;
  /** PKT local ISO string e.g. "2026-03-03T15:00:00" */
  to?: string;
  limit?: number;
}

export interface MachineData {
  _id: string;
  /** UTC ISO from Supabase — display layer converts to PKT */
  timestamp: string;
  machineName: string;
  status: "RUNNING" | "DOWNTIME" | "OFF" | "UNKNOWN";
  machinePower: boolean;
  downtime: boolean;
  shift: "Morning" | "Evening" | "Night" | null;
  durationSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardOverview {
  machineName: string;
  latestStatus: string;
  /** UTC ISO — display layer converts to PKT */
  lastTimestamp: string;
  shift: string | null;
}

export interface DashboardStats {
  RUNNING?: number;
  DOWNTIME?: number;
  OFF?: number;
  UNKNOWN?: number;
}

export interface LiveMachineStatus {
  machine: string;
  status: "RUNNING" | "DOWNTIME" | "OFF" | "UNKNOWN";
  machinePower: boolean;
  downtime: boolean;
  /** UTC ISO — display layer converts to PKT */
  updatedAt: string;
}

export interface LiveStatusStats {
  RUNNING: number;
  DOWNTIME: number;
  OFF: number;
  UNKNOWN: number;
}

export interface DataflowAlert {
  ok: boolean;
  lastUpdate: string;
  delayMinutes: number;
  message: string;
}

// ── Row → MachineData mapper ───────────────────────────────────────────────
function rowToMachineData(row: any): MachineData {
  return {
    _id: row.id,
    timestamp: row.timestamp, // kept as UTC ISO; display layer adds +5h
    machineName: row.machine_name,
    status: row.status,
    machinePower: row.machine_power ?? false,
    downtime: row.downtime ?? false,
    shift: row.shift ?? null,
    durationSeconds: row.duration_seconds ?? 0,
    createdAt: row.created_at ?? row.timestamp,
    updatedAt: row.created_at ?? row.timestamp,
  };
}

// ── fetchMachineData ───────────────────────────────────────────────────────
/**
 * Fetches machine events for the given window.
 *
 * ANCHOR RECORD PATTERN:
 * When a `from` boundary is supplied we also fetch the single most-recent
 * record whose timestamp is strictly BEFORE `from`.  If that record's
 * end time (timestamp + durationSeconds) crosses into the window, it means
 * the machine was mid-status when the window opened.  clipDataToShiftWindow()
 * then trims it to the exact window boundary so the timeline starts cleanly.
 *
 * This replaces the old fixed 2-hour prefetch buffer, which broke for any
 * status that had been running longer than 2 hours before the window started.
 */
export async function fetchMachineData(
  filters?: MachineDataFilters,
): Promise<MachineData[]> {
  // ── 1. Main window query ─────────────────────────────────────────────────
  let query = supabase
    .from("machine_events")
    .select("*")
    .order("timestamp", { ascending: false }); // newest first

  if (filters?.machine) query = query.eq("machine_name", filters.machine);
  if (filters?.from) query = query.gte("timestamp", filters.from);
  if (filters?.to) query = query.lte("timestamp", filters.to);
  if (filters?.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw new Error(`fetchMachineData: ${error.message}`);
  const mainRecords = (data ?? []).map(rowToMachineData);

  // ── 2. Anchor record (only when a from boundary is set) ──────────────────
  // Fetches the 1 record immediately before the window to catch any status
  // that was already in progress when the window opened — no matter how long
  // it has been running (fixes the broken 2h buffer approach).
  if (filters?.from) {
    let anchorQuery = supabase
      .from("machine_events")
      .select("*")
      .lt("timestamp", filters.from) // strictly BEFORE window start
      .order("timestamp", { ascending: false })
      .limit(1);

    if (filters?.machine)
      anchorQuery = anchorQuery.eq("machine_name", filters.machine);

    const { data: anchorData } = await anchorQuery;
    if (anchorData && anchorData.length > 0) {
      const anchor = rowToMachineData(anchorData[0]);
      const anchorEndMs =
        new Date(anchor.timestamp).getTime() +
        (anchor.durationSeconds || 0) * 1000;
      const windowStartMs = new Date(filters.from).getTime();

      // Only prepend if it actually overlaps into the window
      if (anchorEndMs > windowStartMs) {
        mainRecords.push(anchor); // clipDataToShiftWindow will trim it to windowStart
      }
    }
  }

  return mainRecords;
}

// ── fetchDashboardOverview ─────────────────────────────────────────────────
export async function fetchDashboardOverview(): Promise<DashboardOverview[]> {
  const { data: liveRows, error: liveErr } = await supabase
    .from("live_status")
    .select("machine_name, status, updated_at");

  if (liveErr) throw new Error(`fetchDashboardOverview: ${liveErr.message}`);
  if (!liveRows || liveRows.length === 0) return [];

  const machineNames = liveRows.map((r) => r.machine_name);
  const { data: latestEvents, error: evErr } = await supabase
    .from("machine_events")
    .select("machine_name, shift, timestamp")
    .in("machine_name", machineNames)
    .order("timestamp", { ascending: false });

  if (evErr)
    throw new Error(`fetchDashboardOverview (events): ${evErr.message}`);

  const latestMap: Record<string, any> = {};
  for (const ev of latestEvents ?? []) {
    if (!latestMap[ev.machine_name]) latestMap[ev.machine_name] = ev;
  }

  return liveRows.map((row) => ({
    machineName: row.machine_name,
    latestStatus: row.status,
    lastTimestamp: row.updated_at,
    shift: latestMap[row.machine_name]?.shift ?? null,
  }));
}

// ── fetchDashboardStats ────────────────────────────────────────────────────
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await supabase.from("live_status").select("status");
  if (error) throw new Error(`fetchDashboardStats: ${error.message}`);

  const counts: DashboardStats = {};
  for (const row of data ?? []) {
    const s = row.status as keyof DashboardStats;
    counts[s] = (counts[s] ?? 0) + 1;
  }
  return counts;
}

// ── fetchLiveStatus ────────────────────────────────────────────────────────
export async function fetchLiveStatus(): Promise<LiveMachineStatus[]> {
  const { data, error } = await supabase
    .from("live_status")
    .select("machine_name, status, updated_at");

  if (error) throw new Error(`fetchLiveStatus: ${error.message}`);

  return (data ?? []).map((row) => ({
    machine: row.machine_name,
    status: row.status,
    machinePower: row.status !== "OFF",
    downtime: row.status === "DOWNTIME",
    updatedAt: row.updated_at,
  }));
}

// ── fetchDataflowAlert ─────────────────────────────────────────────────────
export async function fetchDataflowAlert(): Promise<DataflowAlert> {
  const { data, error } = await supabase
    .from("live_status")
    .select("updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    return {
      ok: false,
      lastUpdate: "",
      delayMinutes: 9999,
      message: "Unable to determine last data update",
    };
  }

  const lastUpdate = data.updated_at;
  const delayMs = Date.now() - new Date(lastUpdate).getTime();
  const delayMinutes = Math.floor(delayMs / 60000);
  const ok = delayMinutes < 5;

  return {
    ok,
    lastUpdate,
    delayMinutes,
    message: ok
      ? "Data flow is healthy"
      : `No data received for ${delayMinutes} minutes`,
  };
}

// ── exportToCSV ────────────────────────────────────────────────────────────
export async function exportToCSV(filters?: {
  machine?: string;
  from?: string;
  to?: string;
}): Promise<Blob> {
  const data = await fetchMachineData({
    machine: filters?.machine,
    from: filters?.from,
    to: filters?.to,
    limit: 100000,
  });

  const headers = [
    "Machine Name",
    "Timestamp (PKT)",
    "Status",
    "Machine Power",
    "Downtime",
    "Shift",
    "Duration (seconds)",
  ];

  const PKT_MS = 5 * 60 * 60 * 1000;
  const rows = data.map((d) => {
    const pktDate = new Date(new Date(d.timestamp).getTime() + PKT_MS);
    const pktStr = pktDate.toISOString().replace("T", " ").replace("Z", " PKT");
    return [
      d.machineName,
      pktStr,
      d.status,
      d.machinePower ? "true" : "false",
      d.downtime ? "true" : "false",
      d.shift ?? "",
      d.durationSeconds,
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  return new Blob([csv], { type: "text/csv;charset=utf-8;" });
}

export interface CollectorHealth {
  id: string;
  lastSeen: string | null; // UTC ISO
  status: "online" | "offline" | string;
  /** true if status === "online" AND last_seen within last 5 minutes */
  isHealthy: boolean;
  /** how many minutes ago last_seen was (null if never seen) */
  minutesSinceLastSeen: number | null;
}

export async function fetchCollectorHealth(): Promise<CollectorHealth[]> {
  const { data, error } = await supabase
    .from("collector_health")
    .select("id, last_seen, status");

  if (error) throw new Error(`fetchCollectorHealth: ${error.message}`);

  const now = Date.now();
  return (data ?? []).map((row) => {
    const lastSeenMs = row.last_seen ? new Date(row.last_seen).getTime() : null;
    const minutesSinceLastSeen =
      lastSeenMs !== null ? Math.floor((now - lastSeenMs) / 60_000) : null;
    const isHealthy =
      row.status === "online" &&
      minutesSinceLastSeen !== null &&
      minutesSinceLastSeen < 5;

    return {
      id: row.id,
      lastSeen: row.last_seen ?? null,
      status: row.status ?? "offline",
      isHealthy,
      minutesSinceLastSeen,
    };
  });
}
