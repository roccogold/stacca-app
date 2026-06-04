"use client";

import { useMemo } from "react";
import { SwipeableEntryRow } from "@/components/SwipeableEntryRow";
import { OfflinePendingBanner } from "@/components/OfflinePendingBanner";
import { useOfflineSync } from "@/components/OfflineSyncProvider";
import {
  formatHoursIt,
  formatShortWeekdayFromISO,
  sharePercentages,
} from "@/lib/format";
import { useOptimisticHidden } from "@/lib/use-optimistic-hidden";

type ServerEntry = {
  id: string;
  date: string;
  hours: number;
  mansione: string;
  luogo: string;
  note: string | null;
};

type Props = {
  monthPrefix: string;
  serverEntries: ServerEntry[];
  monthSubmitted: boolean;
  selectedDay: string | null;
};

export function MeseOfflineBanner() {
  return (
    <section className="block">
      <OfflinePendingBanner />
    </section>
  );
}

export function useMergedMonthEntries(serverEntries: ServerEntry[], monthPrefix: string) {
  const { mergeWithServer } = useOfflineSync();
  return useMemo(() => {
    const merged = mergeWithServer(serverEntries).filter((e) =>
      e.date.startsWith(monthPrefix),
    );
    return merged;
  }, [mergeWithServer, serverEntries, monthPrefix]);
}

export function MeseEntriesList({
  monthPrefix,
  serverEntries,
  monthSubmitted,
  selectedDay,
}: Props) {
  const { hide, unhide, filterVisible } = useOptimisticHidden();
  const entries = filterVisible(useMergedMonthEntries(serverEntries, monthPrefix));

  const filtered = selectedDay
    ? entries.filter((e) => e.date === selectedDay)
    : entries;

  const grouped = new Map<string, typeof filtered>();
  for (const e of filtered) {
    if (!grouped.has(e.date)) grouped.set(e.date, []);
    grouped.get(e.date)!.push(e);
  }
  const dates = [...grouped.keys()].sort((a, b) => (a < b ? 1 : -1));

  if (dates.length === 0) {
    return <p className="empty-list">Nessun lavoro.</p>;
  }

  return (
    <div className="entry-groups">
      {dates.map((date) => {
        const list = grouped.get(date)!;
        const dayTotal = list.reduce((a, e) => a + e.hours, 0);
        return (
          <div key={date} className="entry-group">
            <div className="entry-group__head">
              <span className="entry-group__date capitalize">
                {formatShortWeekdayFromISO(date)}
              </span>
              <span className="entry-group__total">{formatHoursIt(dayTotal)}</span>
            </div>
            <ul className="entry-list">
              {list.map((e) => (
                <li key={e.id}>
                  <SwipeableEntryRow
                    entryId={e.id}
                    serverId={e.serverId}
                    clientId={e.clientId}
                    pending={e.pending}
                    onDeleteStart={() => hide(e.id)}
                    onDeleteUndo={() => unhide(e.id)}
                    href={
                      monthSubmitted
                        ? undefined
                        : `/aggiungi?edit=${encodeURIComponent(e.id)}`
                    }
                    readOnly={monthSubmitted}
                    hours={e.hours}
                    mansione={e.mansione}
                    luogo={e.luogo}
                    compact
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function useMergedMonthStats(serverEntries: ServerEntry[], monthPrefix: string) {
  const entries = useMergedMonthEntries(serverEntries, monthPrefix);
  return useMemo(() => {
    const totalsByDay: Record<string, number> = {};
    const byMansione = new Map<string, number>();
    const byLuogo = new Map<string, number>();
    let monthTotal = 0;
    for (const e of entries) {
      totalsByDay[e.date] = (totalsByDay[e.date] ?? 0) + e.hours;
      monthTotal += e.hours;
      byMansione.set(e.mansione, (byMansione.get(e.mansione) ?? 0) + e.hours);
      byLuogo.set(e.luogo, (byLuogo.get(e.luogo) ?? 0) + e.hours);
    }
    const mansioniSorted = [...byMansione.entries()].sort((a, b) => b[1] - a[1]);
    const luoghiSorted = [...byLuogo.entries()].sort((a, b) => b[1] - a[1]);
    const mansioniSharePct = sharePercentages(
      mansioniSorted.map(([, hrs]) => hrs),
      monthTotal,
    );
    const luoghiSharePct = sharePercentages(
      luoghiSorted.map(([, hrs]) => hrs),
      monthTotal,
    );
    return {
      entries,
      totalsByDay,
      monthTotal,
      mansioniSorted,
      luoghiSorted,
      mansioniSharePct,
      luoghiSharePct,
    };
  }, [entries]);
}
