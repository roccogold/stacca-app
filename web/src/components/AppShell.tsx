"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";

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
