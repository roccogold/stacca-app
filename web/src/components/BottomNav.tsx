"use client";

import { Calendar, Home, User, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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
  const [popHref, setPopHref] = useState<string | null>(null);

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
              className={`bottom-nav__item${active ? " bottom-nav__item--active" : ""}${
                popHref === tab.href ? " bottom-nav__item--pop" : ""
              }`}
              onPointerDown={() => {
                setPopHref(null);
                requestAnimationFrame(() => setPopHref(tab.href));
              }}
            >
              <span className="bottom-nav__tab">
                {active ? (
                  <span className="bottom-nav__indicator" aria-hidden />
                ) : null}
                <span
                  className="bottom-nav__icon"
                  onAnimationEnd={() => setPopHref(null)}
                >
                  <TabIcon Icon={Icon} />
                </span>
                <span className="bottom-nav__label">{tab.label}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
