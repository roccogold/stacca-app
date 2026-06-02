# Stacca — Logo Handoff

**Concept 02 · Setting sun.** A half-sun with three short rays dipping behind the horizon line — the end of the workday. Flat, warm, reads as a sun (not a hill) down to favicon size. No gradients, no 3D.

---

## Files

| File | Use |
|---|---|
| `icon-olive.svg` | **Primary** app icon (deep olive-night) |
| `icon-terracotta.svg` | Alternate app icon (warm terracotta) |
| `icon-mono.svg` | Monochrome — dark circle, cream sun, for cream UI |
| `mark-ink.svg` | Sun + horizon only, no circle, single dark ink (print / stamps) |
| `lockup-horizontal.svg` | Icon + "Stacca" wordmark, side by side |
| `lockup-stacked.svg` | Icon above wordmark |

All icons are a `120×120` viewBox, so they're resolution-independent. Export to PNG/ICO at `512`, `192`, `180`, `32` as needed.

---

## Color tokens

```css
:root {
  --stacca-olive:  #3D4A35; /* primary circle */
  --stacca-terra:  #632E24; /* alt circle */
  --stacca-sun:    #FBF7F0; /* sun + horizon (white/cream on color) */
  --stacca-ink:    #2A2520; /* wordmark + monochrome circle */
  --stacca-cream:  #FBF7F0; /* app background */
}
```

## Typography

Wordmark is **DM Sans 700** at `letter-spacing: -0.035em`. Inter 700 is the drop-in fallback.

```html
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;600;700&display=swap" rel="stylesheet">
```

> The `.svg` lockups reference DM Sans via `font-family`. For print or environments without the web font, outline the text in your design tool first.

---

## The icon, inline (copy-paste)

```html
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Stacca">
  <circle cx="60" cy="60" r="60" fill="#3D4A35"/>
  <g stroke="#FBF7F0" stroke-width="6" stroke-linecap="round">
    <line x1="60" y1="36" x2="60" y2="26"/>
    <line x1="38" y1="45" x2="31.5" y2="37.5"/>
    <line x1="82" y1="45" x2="88.5" y2="37.5"/>
  </g>
  <defs><clipPath id="staccaHorizon"><rect x="0" y="0" width="120" height="71"/></clipPath></defs>
  <circle cx="60" cy="71" r="22" fill="#FBF7F0" clip-path="url(#staccaHorizon)"/>
  <line x1="22" y1="71" x2="98" y2="71" stroke="#FBF7F0" stroke-width="8.5" stroke-linecap="round"/>
</svg>
```

Recolor by swapping the `circle` fill (`#3D4A35` → `#632E24` for terracotta, `#2A2520` for mono). Keep the sun (`#FBF7F0`) the same.

---

## Lockup component (recommended for the header)

```html
<a class="stacca-logo" href="/">
  <svg class="stacca-logo__icon" viewBox="0 0 120 120" aria-hidden="true">
    <circle cx="60" cy="60" r="60" fill="var(--stacca-olive)"/>
    <g stroke="var(--stacca-sun)" stroke-width="6" stroke-linecap="round">
      <line x1="60" y1="36" x2="60" y2="26"/>
      <line x1="38" y1="45" x2="31.5" y2="37.5"/>
      <line x1="82" y1="45" x2="88.5" y2="37.5"/>
    </g>
    <clipPath id="staccaHorizon"><rect x="0" y="0" width="120" height="71"/></clipPath>
    <circle cx="60" cy="71" r="22" fill="var(--stacca-sun)" clip-path="url(#staccaHorizon)"/>
    <line x1="22" y1="71" x2="98" y2="71" stroke="var(--stacca-sun)" stroke-width="8.5" stroke-linecap="round"/>
  </svg>
  <span class="stacca-logo__word">Stacca</span>
</a>
```

```css
.stacca-logo { display: inline-flex; align-items: center; gap: 11px; text-decoration: none; }
.stacca-logo__icon { width: 38px; height: 38px; display: block; }      /* mobile header size */
.stacca-logo__word {
  font-family: "DM Sans", "Inter", sans-serif;
  font-weight: 700;
  font-size: 21px;
  letter-spacing: -0.035em;
  color: var(--stacca-ink);
  line-height: 1;
}
```

For a stacked layout, set the container to `flex-direction: column; gap: 14px;`.

---

## Usage rules

- **Min size:** the icon reads down to **32px** (favicon). Below that, drop the wordmark and show the circle only.
- **Clear space:** keep padding equal to the radius of the sun (~⅓ of the icon) around the full lockup.
- **Header:** `38×38` icon · `11px` gap · 21px wordmark.
- **App icon:** export `icon-olive.svg` at 512×512; the OS applies its own corner rounding (squircle).
- **Don't:** add gradients, recolor the sun, stretch the wordmark, switch to a serif, or drop the rays (they're what make it read as a sun).

---

## Stroke geometry (if rebuilt)

Inside a `120×120` box: circle `r=60`. The sun is a full disc centered `(60,71)` radius `22`, **clipped to `y ≤ 71`** so only the top half shows. Horizon line at `y=71`, x `22→98`, `stroke-width 8.5`, round caps. Three rays (`stroke-width 6`, round caps) fan above: one vertical at `x=60` and two at ±~40°. All elements share the one sun/cream color.
