"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const ROUTES = ["/", "/mese", "/profilo", "/aggiungi"] as const;

export function PrefetchRoutes() {
  const router = useRouter();

  useEffect(() => {
    for (const route of ROUTES) {
      router.prefetch(route);
    }
  }, [router]);

  return null;
}
