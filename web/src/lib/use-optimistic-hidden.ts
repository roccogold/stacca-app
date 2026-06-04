"use client";

import { useCallback, useState } from "react";

/** Hide list rows immediately while delete/sync runs in the background. */
export function useOptimisticHidden() {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());

  const hide = useCallback((id: string) => {
    setHidden((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const unhide = useCallback((id: string) => {
    setHidden((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const filterVisible = useCallback(
    <T extends { id: string }>(entries: T[]): T[] =>
      entries.filter((e) => !hidden.has(e.id)),
    [hidden],
  );

  return { hide, unhide, filterVisible };
}
