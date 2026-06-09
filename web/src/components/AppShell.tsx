"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { OfflineSyncProvider } from "@/components/OfflineSyncProvider";
import { PrefetchRoutes } from "@/components/PrefetchRoutes";
import { RouteProgress } from "@/components/RouteProgress";

type AppShellProps = {
  children: React.ReactNode;
  userId: string;
  isAdmin?: boolean;
  showNav?: boolean;
};

export function AppShell({ children, userId, isAdmin, showNav }: AppShellProps) {
  const pathname = usePathname();
  const navVisible = showNav ?? !pathname.startsWith("/aggiungi");
  const contentPad = navVisible ? 96 : 120;

  return (
    <OfflineSyncProvider userId={userId}>
      <div className="app-shell">
        <RouteProgress />
        <PrefetchRoutes />
        <div
          className="app-shell__main"
          style={{ paddingBottom: `calc(${contentPad}px + var(--safe-bottom))` }}
        >
          {children}
        </div>
        {navVisible && <BottomNav isAdmin={isAdmin} />}
      </div>
    </OfflineSyncProvider>
  );
}
