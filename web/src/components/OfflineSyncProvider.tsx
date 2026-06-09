"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  enqueueDelete,
  enqueueSave,
  flushOfflineQueue,
  getPendingCount,
  listQueueOps,
  mergeEntriesWithQueue,
  type EntryPayload,
  type MergedEntry,
  type QueueOperation,
} from "@/lib/offline-queue";

export const OFFLINE_FLASH_KEY = "stacca-offline-flash";

export type OfflineFlash = "saved-local" | "synced" | "sync-partial";

export type SyncUiState = "idle" | "syncing" | "error";

type OfflineContextValue = {
  userId: string;
  ops: QueueOperation[];
  pendingCount: number;
  syncState: SyncUiState;
  syncError: string | null;
  online: boolean;
  refreshOps: () => Promise<void>;
  saveEntry: (opts: {
    serverId?: string | null;
    clientId?: string | null;
    payload: EntryPayload;
  }) => Promise<{ offline: boolean; localEntryId?: string }>;
  deleteEntry: (opts: {
    serverId?: string | null;
    clientId?: string | null;
  }) => Promise<{ offline: boolean }>;
  mergeWithServer: (
    serverEntries: Array<{
      id: string;
      date: string;
      hours: number;
      mansione: string;
      luogo: string;
      note: string | null;
    }>,
  ) => MergedEntry[];
  setFlash: (flash: OfflineFlash) => void;
  consumeFlash: () => OfflineFlash | null;
};

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function useOfflineSync(): OfflineContextValue {
  const ctx = useContext(OfflineContext);
  if (!ctx) {
    throw new Error("useOfflineSync must be used within OfflineSyncProvider");
  }
  return ctx;
}

export function useOfflineSyncOptional(): OfflineContextValue | null {
  return useContext(OfflineContext);
}

type Props = {
  userId: string;
  children: React.ReactNode;
};

export function OfflineSyncProvider({ userId, children }: Props) {
  const router = useRouter();
  const [ops, setOps] = useState<QueueOperation[]>([]);
  const [syncState, setSyncState] = useState<SyncUiState>("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [online, setOnline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine,
  );
  const flushing = useRef(false);

  const refreshOps = useCallback(async () => {
    const list = await listQueueOps(userId);
    setOps(list);
  }, [userId]);

  const runFlush = useCallback(async () => {
    if (flushing.current || !navigator.onLine) return;
    const count = await getPendingCount(userId);
    if (count === 0) return;

    flushing.current = true;
    setSyncState("syncing");
    setSyncError(null);
    try {
      const result = await flushOfflineQueue(userId);
      await refreshOps();
      if (result.failed) {
        setSyncState("error");
        setSyncError(result.errorMessage ?? "Invio non completato");
      } else {
        setSyncState("idle");
        if (result.synced > 0) {
          router.refresh();
          try {
            sessionStorage.setItem(OFFLINE_FLASH_KEY, "synced");
          } catch {
            /* ignore */
          }
        }
      }
    } finally {
      flushing.current = false;
    }
  }, [userId, refreshOps, router]);

  useEffect(() => {
    // Loads the offline queue (IndexedDB); setState runs after await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshOps();
  }, [refreshOps]);

  useEffect(() => {
    const on = () => {
      setOnline(true);
      void runFlush();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [runFlush]);

  useEffect(() => {
    // Flushes queued ops when connectivity returns; setState runs after await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (online) void runFlush();
  }, [online, runFlush]);

  const setFlash = useCallback((flash: OfflineFlash) => {
    try {
      sessionStorage.setItem(OFFLINE_FLASH_KEY, flash);
    } catch {
      /* ignore */
    }
  }, []);

  const consumeFlash = useCallback((): OfflineFlash | null => {
    try {
      const v = sessionStorage.getItem(OFFLINE_FLASH_KEY) as OfflineFlash | null;
      if (v) sessionStorage.removeItem(OFFLINE_FLASH_KEY);
      return v;
    } catch {
      return null;
    }
  }, []);

  const saveEntry = useCallback(
    async (opts: {
      serverId?: string | null;
      clientId?: string | null;
      payload: EntryPayload;
    }) => {
      const { postEntryOnline, patchEntryOnline } = await import("@/lib/offline-queue");

      if (navigator.onLine) {
        if (opts.serverId) {
          const res = await patchEntryOnline(opts.serverId, opts.payload);
          if (res.ok) return { offline: false };
          if (res.retryable) {
            await enqueueSave(userId, opts);
            await refreshOps();
            setFlash("saved-local");
            return { offline: true, localEntryId: undefined };
          }
          throw new Error(res.error);
        }
        if (opts.clientId) {
          await enqueueSave(userId, opts);
          const flushNow = await flushOfflineQueue(userId);
          await refreshOps();
          if (!flushNow.failed && flushNow.synced > 0) {
            router.refresh();
            return { offline: false };
          }
        }
        const res = await postEntryOnline(opts.payload);
        if (res.ok) return { offline: false };
        if (res.retryable) {
          const enq = await enqueueSave(userId, {
            clientId: opts.clientId,
            payload: opts.payload,
          });
          await refreshOps();
          setFlash("saved-local");
          return { offline: true, localEntryId: enq.localEntryId };
        }
        throw new Error(res.error);
      }

      const enq = await enqueueSave(userId, opts);
      await refreshOps();
      setFlash("saved-local");
      return { offline: true, localEntryId: enq.localEntryId };
    },
    [userId, refreshOps, setFlash, router],
  );

  const deleteEntry = useCallback(
    async (opts: { serverId?: string | null; clientId?: string | null }) => {
      const { deleteEntryOnline } = await import("@/lib/offline-queue");

      if (opts.clientId && !opts.serverId) {
        await enqueueDelete(userId, opts);
        await refreshOps();
        return { offline: true };
      }

      if (navigator.onLine && opts.serverId) {
        const res = await deleteEntryOnline(opts.serverId);
        if (res.ok) return { offline: false };
        if (res.retryable) {
          await enqueueDelete(userId, opts);
          await refreshOps();
          return { offline: true };
        }
        throw new Error(res.error);
      }

      await enqueueDelete(userId, opts);
      await refreshOps();
      return { offline: true };
    },
    [userId, refreshOps],
  );

  const mergeWithServer = useCallback(
    (
      serverEntries: Array<{
        id: string;
        date: string;
        hours: number;
        mansione: string;
        luogo: string;
        note: string | null;
      }>,
    ) => mergeEntriesWithQueue(serverEntries, ops),
    [ops],
  );

  const value = useMemo<OfflineContextValue>(
    () => ({
      userId,
      ops,
      pendingCount: ops.length,
      syncState,
      syncError,
      online,
      refreshOps,
      saveEntry,
      deleteEntry,
      mergeWithServer,
      setFlash,
      consumeFlash,
    }),
    [
      userId,
      ops,
      syncState,
      syncError,
      online,
      refreshOps,
      saveEntry,
      deleteEntry,
      mergeWithServer,
      setFlash,
      consumeFlash,
    ],
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}
