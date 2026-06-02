"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function RouteProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(false);
  }, [pathname]);

  useEffect(() => {
    function onNavigate() {
      setActive(true);
    }

    document.addEventListener("stacca:navigate", onNavigate);
    return () => document.removeEventListener("stacca:navigate", onNavigate);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      if (anchor.origin !== window.location.origin) return;
      const next = new URL(anchor.href);
      if (next.pathname + next.search === pathname) return;
      setActive(true);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  if (!active) return null;

  return <div className="route-progress" aria-hidden />;
}
