"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  OFFLINE_FLASH_KEY,
  useOfflineSync,
  type OfflineFlash,
} from "@/components/OfflineSyncProvider";
import { OfflinePendingBanner } from "@/components/OfflinePendingBanner";
import { SwipeableEntryRow } from "@/components/SwipeableEntryRow";
import { formatHoursIt } from "@/lib/format";

type ServerEntry = {
  id: string;
  date: string;
  hours: number;
  mansione: string;
  luogo: string;
  note: string | null;
};

type Props = {
  today: string;
  serverTodayEntries: ServerEntry[];
  monthLocked: boolean;
};

const FLASH_COPY: Record<OfflineFlash, string> = {
  "saved-local": "Salvato sul telefono. Verrà inviato quando torna la connessione.",
  synced: "Tutto inviato.",
  "sync-partial": "Alcuni lavori non sono stati inviati. Riprova con il segnale.",
};

export function HomeTodaySection({ today, serverTodayEntries, monthLocked }: Props) {
  const { mergeWithServer, consumeFlash } = useOfflineSync();
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const f = consumeFlash();
    if (f) {
      setFlash(FLASH_COPY[f]);
      const t = window.setTimeout(() => setFlash(null), 5000);
      return () => window.clearTimeout(t);
    }
    try {
      const raw = sessionStorage.getItem(OFFLINE_FLASH_KEY);
      if (raw && raw in FLASH_COPY) {
        sessionStorage.removeItem(OFFLINE_FLASH_KEY);
        setFlash(FLASH_COPY[raw as OfflineFlash]);
        const t = window.setTimeout(() => setFlash(null), 5000);
        return () => window.clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
  }, [consumeFlash]);

  const todayEntries = useMemo(() => {
    const merged = mergeWithServer(serverTodayEntries);
    return merged
      .filter((e) => e.date === today)
      .sort((a, b) => {
        if (a.pending !== b.pending) return a.pending ? 1 : -1;
        return a.mansione.localeCompare(b.mansione, "it");
      });
  }, [mergeWithServer, serverTodayEntries, today]);

  const todayTotal = todayEntries.reduce((a, e) => a + e.hours, 0);
  const lavoriMeta =
    todayEntries.length === 0
      ? "nessun lavoro"
      : todayEntries.length === 1
        ? "1 lavoro"
        : `${todayEntries.length} lavori`;

  return (
    <>
      <section className="block">
        <OfflinePendingBanner />
      </section>

      {flash && (
        <section className="block">
          <p className="offline-flash" role="status">
            {flash}
          </p>
        </section>
      )}

      <section className="block">
        <div className="card card--accent card--oggi card--oggi--home">
          <div className="card--oggi__label">OGGI</div>
          <div className="card--oggi__filled">
            <span className="card--oggi__num--duration">{formatHoursIt(todayTotal)}</span>
            <span className="badge badge--on-accent">{lavoriMeta}</span>
          </div>
          {!monthLocked && (
            <Link href="/aggiungi" prefetch className="card--oggi__cta">
              <Plus size={18} strokeWidth={2.5} aria-hidden />
              Aggiungi ore
            </Link>
          )}
        </div>
      </section>

      {todayEntries.length > 0 && (
        <section className="block">
          <h2 className="section-title section-title--inset">I lavori di oggi</h2>
          <ul className="entry-list">
            {todayEntries.map((e) => (
              <li key={e.id}>
                <SwipeableEntryRow
                  entryId={e.id}
                  serverId={e.serverId}
                  clientId={e.clientId}
                  pending={e.pending}
                  href={
                    monthLocked
                      ? undefined
                      : `/aggiungi?edit=${encodeURIComponent(e.id)}`
                  }
                  readOnly={monthLocked}
                  hours={e.hours}
                  mansione={e.mansione}
                  luogo={e.luogo}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
