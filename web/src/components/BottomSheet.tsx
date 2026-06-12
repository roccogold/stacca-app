"use client";

import { useEffect, type ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function BottomSheet({ open, onClose, title, subtitle, children }: Props) {
  // Lock the page behind the sheet so touch-scrolling stays inside the form
  // instead of dragging the list underneath (iOS scroll chaining).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="sheet-bg" onClick={onClose} role="presentation">
      <div
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
      >
        <div className="sheet__handle" aria-hidden />
        <h3 id="sheet-title" className="sheet__title">
          {title}
        </h3>
        {subtitle && <p className="sheet__subtitle">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
