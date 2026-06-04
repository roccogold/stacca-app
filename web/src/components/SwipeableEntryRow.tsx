"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { EntryCardLink } from "@/components/EntryCardLink";
import { useOfflineSync } from "@/components/OfflineSyncProvider";
import { isLocalEntryId, parseLocalEntryId } from "@/lib/offline-queue";

const REVEAL_PX = 88;
const OPEN_THRESHOLD = 44;

type Props = {
  entryId: string;
  serverId?: string | null;
  clientId?: string | null;
  pending?: boolean;
  href?: string;
  readOnly?: boolean;
  hours: number;
  mansione: string;
  luogo: string;
  compact?: boolean;
};

export function SwipeableEntryRow({
  entryId,
  serverId = null,
  clientId = null,
  pending = false,
  href,
  readOnly = false,
  hours,
  mansione,
  luogo,
  compact,
}: Props) {
  const router = useRouter();
  const { deleteEntry } = useOfflineSync();
  const [offset, setOffsetState] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const startX = useRef(0);
  const startOffset = useRef(0);
  const didDrag = useRef(false);
  const isDragging = useRef(false);
  const offsetRef = useRef(0);

  const setOffset = useCallback((value: number) => {
    offsetRef.current = value;
    setOffsetState(value);
  }, []);

  const snapClosed = useCallback(() => setOffset(0), [setOffset]);

  if (readOnly || !href) {
    return (
      <EntryCardLink
        href={href}
        readOnly={readOnly || !href}
        hours={hours}
        mansione={mansione}
        luogo={luogo}
        compact={compact}
        pending={pending}
      />
    );
  }

  function onPointerDown(clientX: number) {
    startX.current = clientX;
    startOffset.current = offset;
    didDrag.current = false;
    isDragging.current = true;
    setDragging(true);
  }

  function onPointerMove(clientX: number) {
    if (!isDragging.current) return;
    const delta = clientX - startX.current;
    if (Math.abs(delta) > 6) didDrag.current = true;
    const next = Math.min(0, Math.max(-REVEAL_PX, startOffset.current + delta));
    setOffset(next);
  }

  function onPointerEnd() {
    if (!isDragging.current) return;
    isDragging.current = false;
    setDragging(false);
    const current = offsetRef.current;
    setOffset(current <= -OPEN_THRESHOLD ? -REVEAL_PX : 0);
  }

  async function handleDelete() {
    if (!confirm("Vuoi davvero eliminare questo lavoro?")) return;
    setDeleting(true);
    try {
      const resolvedServerId =
        serverId ?? (isLocalEntryId(entryId) ? null : entryId);
      const resolvedClientId =
        clientId ?? parseLocalEntryId(entryId);

      const { deleteEntryOnline } = await import("@/lib/offline-queue");
      if (resolvedClientId && !resolvedServerId) {
        await deleteEntry({ clientId: resolvedClientId });
        snapClosed();
        router.refresh();
        return;
      }
      if (resolvedServerId && navigator.onLine) {
        const res = await deleteEntryOnline(resolvedServerId);
        if (res.ok) {
          snapClosed();
          router.refresh();
          return;
        }
        if (res.retryable) {
          await deleteEntry({ serverId: resolvedServerId });
          snapClosed();
          router.refresh();
          return;
        }
        alert(res.error);
        return;
      }
      if (resolvedServerId) {
        await deleteEntry({ serverId: resolvedServerId });
        snapClosed();
        router.refresh();
        return;
      }
      alert("Errore nell'eliminazione");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Errore nell'eliminazione");
    } finally {
      setDeleting(false);
    }
  }

  function handleCardClick(e: React.MouseEvent) {
    if (didDrag.current) {
      e.preventDefault();
      return;
    }
    if (offsetRef.current <= -OPEN_THRESHOLD / 2) {
      e.preventDefault();
      snapClosed();
    }
  }

  const isOpen = offset <= -OPEN_THRESHOLD / 2;

  return (
    <div className={`entry-swipe${isOpen ? " entry-swipe--open" : ""}`}>
      <div className="entry-swipe__underlay" aria-hidden>
        <button
          type="button"
          className="entry-swipe__delete"
          onClick={handleDelete}
          disabled={deleting}
          aria-label="Elimina lavoro"
        >
          <Trash2 size={22} strokeWidth={2} aria-hidden />
          <span>Elimina</span>
        </button>
      </div>
      <div
        className={`entry-swipe__panel${dragging ? " entry-swipe__panel--dragging" : ""}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          onPointerDown(e.clientX);
        }}
        onPointerMove={(e) => onPointerMove(e.clientX)}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={handleCardClick}
      >
        <EntryCardLink
          href={href}
          hours={hours}
          mansione={mansione}
          luogo={luogo}
          compact={compact}
          pending={pending}
        />
      </div>
    </div>
  );
}
