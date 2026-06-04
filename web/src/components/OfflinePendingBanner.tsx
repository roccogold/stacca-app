"use client";

import { CloudOff, Loader2 } from "lucide-react";
import { useOfflineSync } from "@/components/OfflineSyncProvider";

export function OfflinePendingBanner() {
  const { pendingCount, syncState, syncError, online } = useOfflineSync();

  if (pendingCount === 0 && syncState !== "error") return null;

  if (syncState === "syncing") {
    return (
      <div className="offline-banner offline-banner--syncing" role="status">
        <Loader2 size={20} className="offline-banner__spin" aria-hidden />
        <div className="offline-banner__text">
          <span className="offline-banner__title">Invio in corso…</span>
        </div>
      </div>
    );
  }

  if (syncState === "error") {
    return (
      <div className="offline-banner offline-banner--error" role="alert">
        <CloudOff size={20} aria-hidden />
        <div className="offline-banner__text">
          <span className="offline-banner__title">
            Non tutto è stato inviato
          </span>
          <span className="offline-banner__sub">
            {syncError ?? "Apri l'app con il segnale per riprovare."}
          </span>
        </div>
      </div>
    );
  }

  const label =
    pendingCount === 1
      ? "1 lavoro da inviare"
      : `${pendingCount} lavori da inviare`;

  return (
    <div className="offline-banner" role="status">
      <CloudOff size={20} aria-hidden />
      <div className="offline-banner__text">
        <span className="offline-banner__title">{label}</span>
        <span className="offline-banner__sub">
          {online
            ? "Si aggiorna da solo tra poco"
            : "Si inviano quando torna la connessione"}
        </span>
      </div>
    </div>
  );
}
