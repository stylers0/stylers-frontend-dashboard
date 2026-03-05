import { dateToUTCIso } from "@/lib/timeUtils";

/**
 * Convert a Date from the browser date-picker into a UTC ISO string
 * suitable for passing to api.ts / Supabase.
 *
 * A browser Date always stores absolute UTC milliseconds internally.
 * .toISOString() gives the correct UTC — no manual offset needed.
 * Works regardless of browser timezone setting.
 */
export function toLocalISOString(date: Date): string {
  return dateToUTCIso(date);
}
