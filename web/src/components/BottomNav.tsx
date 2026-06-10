"use client";

import { Calendar, Home, User, UserCog, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (p: string) => boolean;
};

const baseTabs: Tab[] = [
  { href: "/", label: "Oggi", icon: Home, match: (p) => p === "/" },
  { href: "/mese", label: "Mese", icon: Calendar, match: (p) => p.startsWith("/mese") },
];

const adminTab: Tab = {
  href: "/dipendenti",
  label: "Admin",
  icon: UserCog,
  // Admin hub spans three routes (Dipendenti / Lavorazioni / Luoghi); keep the
  // single bottom tab highlighted on all of them.
  match: (p) =>
    p.startsWith("/dipendenti") ||
    p.startsWith("/lavorazioni") ||
    p.startsWith("/luoghi"),
};

// Profilo stays last in the bar; the admin tab slots in just before it.
const profiloTab: Tab = {
  href: "/profilo",
  label: "Profilo",
  icon: User,
  match: (p) => p.startsWith("/profilo"),
};

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

export function BottomNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const [popHref, setPopHref] = useState<string | null>(null);
  const tabs = isAdmin ? [...baseTabs, adminTab, profiloTab] : [...baseTabs, profiloTab];

  return (
    <nav className="bottom-nav" aria-label="Navigazione principale">
      <div
        className={`bottom-nav__inner${isAdmin ? " bottom-nav__inner--admin" : ""}`}
      >
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
