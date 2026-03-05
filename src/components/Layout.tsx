import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Activity, WifiOff } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [isOnline, setIsOnline] = useState(true);

  // 🌐 Internet Connection Watcher
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          {/* 🔝 Top Navigation Bar */}
          <header className="h-14 border-b bg-card flex items-center justify-between px-4 sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <div className="flex items-center gap-2">
                <Activity className="w-6 h-6 text-primary" />
                <span className="text-lg font-bold">Stylers</span>
              </div>
            </div>
            {/* <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <Bell className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <Settings className="w-4 h-4" />
                </Button>
                </div> */}
            <span className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </header>

          {/* 🌐 Offline Internet Alert */}
          {!isOnline && (
            <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-2 text-sm font-medium flex items-center gap-2 justify-center">
              <WifiOff className="w-4 h-4" />
              <span>
                No Internet connection. Some features may be unavailable.
              </span>
            </div>
          )}

          {/* 🧭 Main Content */}
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
