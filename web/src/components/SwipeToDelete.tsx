"use client";

import { Trash2 } from "lucide-react";
import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

const REVEAL_PX = 88;
const OPEN_THRESHOLD = 44;

type Props = {
  onDelete: () => void;
  label?: string;
  ariaLabel?: string;
  /**
   * When false, the sliding panel is itself the white card (border, radius,
   * shadow) over the red underlay — the homogeneous look of the entries list.
   * When true (default), the panel is transparent and the child provides its
   * own card (e.g. the employee cards).
   */
  bare?: boolean;
  children: ReactNode;
};

/** Swipe-left to reveal a red Delete action — same UI as the entries list. */
export function SwipeToDelete({
  onDelete,
  label = "Elimina",
  ariaLabel = "Elimina",
  bare = true,
  children,
}: Props) {
  const [offset, setOffsetState] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startOffset = useRef(0);
  const didDrag = useRef(false);
  const isDragging = useRef(false);
  const captured = useRef(false);
  const offsetRef = useRef(0);

  const setOffset = useCallback((v: number) => {
    offsetRef.current = v;
    setOffsetState(v);
  }, []);

  function onDown(clientX: number) {
    startX.current = clientX;
    startOffset.current = offsetRef.current;
    didDrag.current = false;
    captured.current = false;
    isDragging.current = true;
    setDragging(true);
  }
  function onMove(e: ReactPointerEvent) {
    if (!isDragging.current) return;
    const delta = e.clientX - startX.current;
    if (Math.abs(delta) > 6) {
      didDrag.current = true;
      // Capture only once a real drag begins. Capturing on pointerdown would
      // make the browser dispatch the click on this wrapper instead of the
      // tapped child (e.g. the edit button), swallowing its onClick.
      if (!captured.current) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
          captured.current = true;
        } catch {
          // ignore (capture not supported / pointer already gone)
        }
      }
    }
    setOffset(Math.min(0, Math.max(-REVEAL_PX, startOffset.current + delta)));
  }
  function onEnd() {
    if (!isDragging.current) return;
    isDragging.current = false;
    captured.current = false;
    setDragging(false);
    setOffset(offsetRef.current <= -OPEN_THRESHOLD ? -REVEAL_PX : 0);
  }

  const isOpen = offset <= -OPEN_THRESHOLD / 2;

  return (
    <div className={`entry-swipe${isOpen ? " entry-swipe--open" : ""}`}>
      <div className="entry-swipe__underlay" aria-hidden>
        <button
          type="button"
          className="entry-swipe__delete"
          onClick={() => {
            setOffset(0);
            onDelete();
          }}
          aria-label={ariaLabel}
        >
          <Trash2 size={22} strokeWidth={2} aria-hidden />
          <span>{label}</span>
        </button>
      </div>
      <div
        className={`entry-swipe__panel${bare ? " entry-swipe__panel--bare" : ""}${dragging ? " entry-swipe__panel--dragging" : ""}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          onDown(e.clientX);
        }}
        onPointerMove={onMove}
        onPointerUp={onEnd}
        onPointerCancel={onEnd}
        onClickCapture={(e) => {
          // Swallow the click (e.g. the expand toggle) if this was a drag or the row is open.
          if (didDrag.current) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (offsetRef.current <= -OPEN_THRESHOLD / 2) {
            e.preventDefault();
            e.stopPropagation();
            setOffset(0);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
