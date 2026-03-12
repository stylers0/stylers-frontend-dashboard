import { useEffect, useState, useCallback } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Activity, WifiOff, ServerCrash, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { fetchCollectorHealth, CollectorHealth } from "@/lib/api";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [collectorHealth, setCollectorHealth] =
    useState<CollectorHealth | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // ── Browser connectivity watcher ────────────────────────────────────────
  useEffect(() => {
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // ── Collector health poller ──────────────────────────────────────────────
  const checkHealth = useCallback(async (showRetry = false) => {
    if (showRetry) setRetrying(true);
    try {
      const results = await fetchCollectorHealth();
      // We care about the "main" collector; fall back to first row
      const main = results.find((r) => r.id === "main") ?? results[0] ?? null;
      setCollectorHealth(main);
      setHealthError(false);
    } catch {
      setHealthError(true);
    } finally {
      if (showRetry) setRetrying(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 60_000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  // ── Derived states ───────────────────────────────────────────────────────
  const scadaDown =
    healthError || (collectorHealth !== null && !collectorHealth.isHealthy);

  const minutesAgo = collectorHealth?.minutesSinceLastSeen ?? null;

  const scadaMessage = (() => {
    if (healthError) return "Unable to reach the collector health service.";
    if (!collectorHealth) return "Collector status unknown.";
    if (collectorHealth.status === "offline")
      return "Data collector is offline.";
    if (minutesAgo !== null && minutesAgo >= 5)
      return `No data received for ${minutesAgo} minute${minutesAgo !== 1 ? "s" : ""}.`;
    return "Data collector is not responding.";
  })();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          {/* ── Top Navigation Bar ──────────────────────────────────────── */}
          <header className="h-14 border-b bg-card flex items-center justify-between px-4 sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <div className="flex items-center gap-2">
                <Activity className="w-6 h-6 text-primary" />
                <span className="text-lg font-bold">Stylers</span>
              </div>
            </div>
            <span className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </header>

          {/* ── No Internet Banner ──────────────────────────────────────── */}
          {!isOnline && (
            <div className="bg-destructive/10 border-b border-destructive/40 text-destructive px-4 py-2 text-sm font-medium flex items-center gap-2 justify-center">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>
                No internet connection — live data and updates are paused.
              </span>
            </div>
          )}

          {/* ── SCADA / Collector Offline Banner ────────────────────────── */}
          {scadaDown && (
            <div className="bg-warning/10 border-b border-warning/40 text-warning-foreground px-4 py-2.5 text-sm flex flex-wrap items-center gap-x-4 gap-y-1 justify-center">
              <div className="flex items-center gap-2 font-semibold text-amber-600 dark:text-amber-400">
                <ServerCrash className="w-4 h-4 shrink-0" />
                <span>SCADA Collector Offline</span>
              </div>
              <span className="text-muted-foreground">
                {scadaMessage} Please check your SCADA system or retry later.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => checkHealth(true)}
                disabled={retrying}
                className="h-7 px-3 text-xs border-amber-400/50 hover:border-amber-400">
                <RefreshCw
                  className={`w-3 h-3 mr-1 ${retrying ? "animate-spin" : ""}`}
                />
                {retrying ? "Checking…" : "Retry"}
              </Button>
            </div>
          )}

          {/* ── Main Content ────────────────────────────────────────────── */}
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
