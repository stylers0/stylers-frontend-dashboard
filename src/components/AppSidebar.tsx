import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Activity, LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "@/contexts/AuthContext";

export function AppSidebar() {
  const { logout } = useAuth();
  return (
    <Sidebar className="border-r bg-white">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" />
          <span className="text-lg font-bold text-gray-900">Stylers</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-4">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">
            Main Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    `block w-full px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? "bg-[#0d4da5] text-white font-medium"
                        : "text-gray-700 hover:bg-gray-100"
                    }`
                  }>
                  {({ isActive }) => (
                    <div className="flex items-center gap-3">
                      <LayoutDashboard
                        className={`w-4 h-4 ${
                          isActive ? "text-white" : "text-gray-500"
                        }`}
                      />
                      <span>Dashboard</span>
                    </div>
                  )}
                </NavLink>
              </SidebarMenuItem>
              {/* <SidebarMenuItem>
                <NavLink
                  to="/live-status"
                  className={({ isActive }) =>
                    `block w-full px-3 py-2 rounded-lg transition-colors mt-1 ${
                      isActive
                        ? "bg-[#0d4da5] text-white font-medium"
                        : "text-gray-700 hover:bg-gray-100"
                    }`
                  }>
                  {({ isActive }) => (
                    <div className="flex items-center gap-3">
                      <LayoutDashboard
                        className={`w-4 h-4 ${
                          isActive ? "text-white" : "text-gray-500"
                        }`}
                      />
                      <span>Live Tracking</span>
                    </div>
                  )}
                </NavLink>
              </SidebarMenuItem> */}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <div className="p-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="w-full justify-start bg-red-500 text-white hover:bg-red-600">
          <LogOut className="h-4 w-4 mr-1" />
          Logout
        </Button>
      </div>
      <SidebarFooter className="border-t p-4 bg-gray-50">
        <div className="text-xs text-gray-500">
          <p>© 2025 Stylers</p>
          <p>Real-time Machine Tracking</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
