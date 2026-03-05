import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment variables",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export type Database = {
  public: {
    Tables: {
      machine_events: {
        Row: {
          id: string;
          machine_name: string;
          timestamp: string;
          status: "RUNNING" | "DOWNTIME" | "OFF" | "UNKNOWN";
          machine_power: boolean;
          downtime: boolean;
          shift: "Morning" | "Evening" | "Night" | null;
          duration_seconds: number;
          created_at: string;
        };
      };
      live_status: {
        Row: {
          machine_name: string;
          status: "RUNNING" | "DOWNTIME" | "OFF" | "UNKNOWN";
          updated_at: string;
        };
      };
    };
  };
};
