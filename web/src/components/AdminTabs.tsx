"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dipendenti", label: "Dipendenti" },
  { href: "/aree", label: "Settori" },
  { href: "/lavorazioni", label: "Lavorazioni" },
  { href: "/luoghi", label: "Luoghi" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="admin-tabs" aria-label="Sezioni amministrazione">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch
            className={`admin-tabs__tab${active ? " admin-tabs__tab--active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
