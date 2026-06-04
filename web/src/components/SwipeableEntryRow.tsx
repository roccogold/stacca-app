"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { EntryCardLink } from "@/components/EntryCardLink";

const REVEAL_PX = 92;
const OPEN_THRESHOLD = 46;

type Props = {
  entryId: string;
  href?: string;
  readOnly?: boolean;
  hours: number;
  mansione: string;
  luogo: string;
  compact?: boolean;
};

export function SwipeableEntryRow({
  entryId,
  href,
  readOnly = false,
  hours,
  mansione,
  luogo,
  compact,
}: Props) {
  const router = useRouter();
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
      const res = await fetch(`/api/entries/${entryId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof data.error === "string" ? data.error : "Errore nell'eliminazione");
        return;
      }
      snapClosed();
      router.refresh();
    } catch {
      alert("Errore nell'eliminazione");
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
      <button
        type="button"
        className="entry-swipe__delete"
        onClick={handleDelete}
        disabled={deleting}
        aria-label="Elimina lavoro"
      >
        <Trash2 size={20} strokeWidth={2} aria-hidden />
        <span>Elimina</span>
      </button>
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
        />
      </div>
    </div>
  );
}
