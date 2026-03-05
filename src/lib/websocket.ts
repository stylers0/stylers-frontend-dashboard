// ─────────────────────────────────────────────────────────────────────────────
// websocket.ts  —  Replaced by Supabase Realtime
//
// This module re-exports a thin wrapper around Supabase Realtime channels so
// that all existing call-sites (Dashboard, MachineDetail) keep working with
// zero changes to those files.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type WebSocketMessage = {
  type: string;
  id?: string;
  timestamp?: string;
  machine?: string;
  status?: string;
  shift?: string;
  [key: string]: any;
};

export type WebSocketCallback = (message: WebSocketMessage) => void;

class SupabaseRealtimeClient {
  private channel: RealtimeChannel | null = null;
  private callbacks: Set<WebSocketCallback> = new Set();

  connect() {
    if (this.channel) return; // already connected

    // Subscribe to INSERT / UPDATE on both tables
    this.channel = supabase
      .channel("machine-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "machine_events" },
        (payload) => {
          const row = payload.new as any;
          const msg: WebSocketMessage = {
            type: "machine_update",
            id: row.id,
            machine: row.machine_name,
            status: row.status,
            timestamp: row.timestamp,
            shift: row.shift,
            machinePower: row.machine_power,
            downtime: row.downtime,
            durationSeconds: row.duration_seconds,
          };
          this.callbacks.forEach((cb) => cb(msg));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_status" },
        (payload) => {
          const row = payload.new as any;
          const msg: WebSocketMessage = {
            type: "live_status_update",
            machine: row.machine_name,
            status: row.status,
            timestamp: row.updated_at,
          };
          this.callbacks.forEach((cb) => cb(msg));
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ Supabase Realtime connected");
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ Supabase Realtime channel error — will retry");
        }
      });
  }

  subscribe(callback: WebSocketCallback) {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  disconnect() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.callbacks.clear();
  }

  /** No-op kept for API compatibility */
  send(_data: any) {
    console.warn("send() is a no-op with Supabase Realtime (read-only).");
  }
}

// Singleton
let realtimeClient: SupabaseRealtimeClient | null = null;

export function getWebSocketClient(): SupabaseRealtimeClient {
  if (!realtimeClient) {
    realtimeClient = new SupabaseRealtimeClient();
    realtimeClient.connect();
  }
  return realtimeClient;
}

export function disconnectWebSocket() {
  if (realtimeClient) {
    realtimeClient.disconnect();
    realtimeClient = null;
  }
}
