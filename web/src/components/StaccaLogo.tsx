"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useId } from "react";

type Props = {
  /** Icon size in px (wordmark scales from this). */
  size?: number;
  linked?: boolean;
  variant?: "horizontal" | "stacked" | "icon";
};

function StaccaIcon({ size, clipId }: { size: number; clipId: string }) {
  return (
    <svg
      className="stacca-logo__icon"
      viewBox="0 0 120 120"
      width={size}
      height={size}
      aria-hidden
    >
      <circle cx="60" cy="60" r="60" fill="var(--stacca-olive)" />
      <g stroke="var(--stacca-sun)" strokeWidth="6" strokeLinecap="round">
        <line x1="60" y1="36" x2="60" y2="26" />
        <line x1="38" y1="45" x2="31.5" y2="37.5" />
        <line x1="82" y1="45" x2="88.5" y2="37.5" />
      </g>
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width="120" height="71" />
        </clipPath>
      </defs>
      <circle cx="60" cy="71" r="22" fill="var(--stacca-sun)" clipPath={`url(#${clipId})`} />
      <line
        x1="22"
        y1="71"
        x2="98"
        y2="71"
        stroke="var(--stacca-sun)"
        strokeWidth="8.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function StaccaLogo({
  size = 38,
  linked = true,
  variant = "horizontal",
}: Props) {
  const clipId = useId().replace(/:/g, "");
  const wordSize = Math.round(size * 0.55);

  const content =
    variant === "icon" ? (
      <StaccaIcon size={size} clipId={clipId} />
    ) : (
      <div
        className={`stacca-logo stacca-logo--${variant}`}
        style={{ "--stacca-icon-size": `${size}px`, "--stacca-word-size": `${wordSize}px` } as CSSProperties}
      >
        <StaccaIcon size={size} clipId={clipId} />
        <span className="stacca-logo__word">Stacca</span>
      </div>
    );

  if (linked) {
    return (
      <Link href="/" className="link-plain stacca-logo__link" aria-label="Stacca — home">
        {content}
      </Link>
    );
  }

  return content;
}
