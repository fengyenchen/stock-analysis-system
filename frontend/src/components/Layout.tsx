import { Outlet } from "react-router-dom";
import { DesktopNavbar } from "./DesktopNavbar";
import { BottomTabBar } from "./BottomTabBar";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { WifiOff } from "lucide-react";

export function Layout() {
  const isOnline = useOnlineStatus();

  return (
    <div className="flex flex-col min-h-screen">
      <DesktopNavbar />

      {/* Offline indicator */}
      {!isOnline && (
        <div className="hidden md:flex items-center justify-center gap-2 bg-amber-500 text-white text-xs py-1 px-4">
          <WifiOff className="w-3 h-3" />
          <span>You are offline. Some features may not be available.</span>
        </div>
      )}

      <main className="flex-1 w-full md:container md:mx-auto md:px-4 md:py-6 md:max-w-6xl px-0 py-0 pb-20 md:pb-6">
        <Outlet />
      </main>

      <BottomTabBar />
    </div>
  );
}
