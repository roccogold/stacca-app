"use client";

import { Calendar, Home, User, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Oggi", icon: Home, match: (p: string) => p === "/" },
  { href: "/mese", label: "Mese", icon: Calendar, match: (p: string) => p.startsWith("/mese") },
  { href: "/profilo", label: "Profilo", icon: User, match: (p: string) => p.startsWith("/profilo") },
] as const;

function TabIcon({ Icon }: { Icon: LucideIcon }) {
  const { pending } = useLinkStatus();
  return (
    <Icon
      size={24}
      strokeWidth={2}
      aria-hidden
      className={pending ? "bottom-nav__icon--pending" : undefined}
    />
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="Navigazione principale">
      <div className="bottom-nav__inner">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch
              className={`bottom-nav__item${active ? " bottom-nav__item--active" : ""}`}
            >
              <TabIcon Icon={Icon} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
