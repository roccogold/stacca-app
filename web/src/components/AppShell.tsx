"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { PrefetchRoutes } from "@/components/PrefetchRoutes";
import { RouteProgress } from "@/components/RouteProgress";

type AppShellProps = {
  children: React.ReactNode;
  showNav?: boolean;
};

export function AppShell({ children, showNav }: AppShellProps) {
  const pathname = usePathname();
  const navVisible = showNav ?? !pathname.startsWith("/aggiungi");
  const contentPad = navVisible ? 96 : 120;

  return (
    <div className="app-shell">
      <RouteProgress />
      <PrefetchRoutes />
      <div
        className="app-shell__main"
        style={{ paddingBottom: `calc(${contentPad}px + var(--safe-bottom))` }}
      >
        {children}
      </div>
      {navVisible && <BottomNav />}
    </div>
  );
}
