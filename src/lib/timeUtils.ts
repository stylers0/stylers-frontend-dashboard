/**
 * timeUtils.ts — Pakistan Standard Time (PKT = UTC+5) helpers
 *
 * GROUND TRUTH:
 *  • The Python collector subtracts 5h before saving → Supabase stores genuine UTC.
 *  • Supabase returns timestamps like "2025-11-26T06:58:35+00:00" (UTC).
 *  • To DISPLAY correct PKT we ADD 5h to the UTC ms value.
 *  • To QUERY Supabase with a PKT wall-clock time we SUBTRACT 5h → UTC ISO string.
 *
 * All filter strings passed to api.ts are REAL UTC ISO strings (ending in Z).
 * This way nothing depends on the browser's timezone setting.
 */

export const PKT_OFFSET_MS = 5 * 60 * 60 * 1000; // 18000000 ms

// ── Display helpers ────────────────────────────────────────────────────────

/**
 * Parse a UTC timestamp from Supabase into a PKT-shifted Date.
 * The returned Date's .getUTCHours() etc. give the PKT wall-clock time.
 */
export function parsePKTTimestamp(isoString: string): Date {
  if (!isoString) return new Date();
  const utcDate = new Date(isoString);
  if (isNaN(utcDate.getTime())) return new Date();
  return new Date(utcDate.getTime() + PKT_OFFSET_MS);
}

/** Format a PKT-shifted Date → "DD-MM-YYYY" */
export function formatDisplayDate(date: Date): string {
  const d = date.getUTCDate().toString().padStart(2, "0");
  const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const y = date.getUTCFullYear();
  return `${d}-${m}-${y}`;
}

/** Format a PKT-shifted Date → "H:MM AM/PM" */
export function formatDisplayTime(date: Date): string {
  let hours = date.getUTCHours();
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

/** Format a PKT-shifted Date → "H:MM:SS AM/PM" */
export function formatDisplayTimeWithSeconds(date: Date): string {
  let hours = date.getUTCHours();
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const seconds = date.getUTCSeconds().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes}:${seconds} ${ampm}`;
}

/** Format a PKT-shifted Date → "DD-MM-YYYY H:MM AM/PM" */
export function formatDisplayDateTime(date: Date): string {
  return `${formatDisplayDate(date)} ${formatDisplayTime(date)}`;
}

/** Human-readable "time ago" from a real UTC Date */
export function formatTimeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

// ── Query helpers (produce UTC ISO strings for Supabase) ───────────────────

/**
 * Current real UTC time in milliseconds.
 * Use this as the baseline for all "now" calculations.
 */
export function utcNow(): number {
  return Date.now();
}

/**
 * Get the current PKT hour (0-23) from real UTC time.
 * Used for shift detection — no browser timezone dependency.
 */
export function currentPKTHour(): number {
  return new Date(Date.now() + PKT_OFFSET_MS).getUTCHours();
}

/**
 * Build a UTC ISO string for "PKT midnight of today".
 * e.g. if PKT is 2026-03-03 any time → returns "2026-03-02T19:00:00.000Z"
 * (because PKT midnight = UTC previous day 19:00)
 */
export function pktMidnightUTC(offsetDays = 0): string {
  const nowPKT = new Date(Date.now() + PKT_OFFSET_MS);
  // Zero out PKT time to get PKT midnight
  const pktMidnight = Date.UTC(
    nowPKT.getUTCFullYear(),
    nowPKT.getUTCMonth(),
    nowPKT.getUTCDate() + offsetDays,
    0, 0, 0, 0,
  );
  // PKT midnight → subtract 5h to get real UTC
  return new Date(pktMidnight - PKT_OFFSET_MS).toISOString();
}

/**
 * Convert a PKT wall-clock hour (e.g. 7 for 7:00 AM PKT) on today's PKT date
 * into a UTC ISO string.
 */
export function pktHourToUTCIso(pktHour: number, offsetDays = 0): string {
  const nowPKT = new Date(Date.now() + PKT_OFFSET_MS);
  const utcMs = Date.UTC(
    nowPKT.getUTCFullYear(),
    nowPKT.getUTCMonth(),
    nowPKT.getUTCDate() + offsetDays,
    pktHour, 0, 0, 0,
  ) - PKT_OFFSET_MS;
  return new Date(utcMs).toISOString();
}

/**
 * Convert a JS Date (from a browser date-picker, in browser local time)
 * into a UTC ISO string. Works correctly regardless of browser timezone
 * because Date objects always carry absolute UTC ms internally.
 */
export function dateToUTCIso(date: Date): string {
  return date.toISOString();
}
