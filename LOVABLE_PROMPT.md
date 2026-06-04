# Lovable prompt — Stacca (field worker hours app)

Copy everything below the line into Lovable.

---

Build a **mobile-first web app** (PWA-style, phone only — no desktop admin UI) called **Stacca** for **vineyard/field workers** at a small winery in Tuscany (Corzano e Paterno). Users are **not comfortable with computers** — big tap targets, minimal typing, Italian language, zero jargon.

## Product goal

Workers log **hours per day** with **task (mansione)** and **place (luogo/vigna)**. At **month end** they **submit one final monthly report** that creates a row/summary in **Google Sheets** (admin). After submit, that month is **locked** — no edits, no resubmit.

## Brand & tone

- App name: **Stacca** — “stacca” = clock off / end of shift. Warm, Tuscan, human — not corporate HR software.
- Visual: warm Tuscan palette — cream background `#FBF7F0`, wine red `#7A2E2E`, olive green `#5A6B3F` / `#3D4A35`, white cards, soft shadows, rounded corners (16px).
- Typography: modern sans-serif (Bricolage Grotesque for UI; **DM Sans 700** for logo wordmark) — **no tiny text**, minimum 16px body.
- Language: **Italian** for all UI copy.
- Logo: **setting sun** icon (half sun dipping below horizon + three rays) in olive circle `#3D4A35`, cream sun `#FBF7F0`, wordmark **Stacca** in ink `#2A2520`. See `web/public/stacca/` for SVG handoff. Not a clock, not a face.

## Core user flow

```
Login → Home (today) → Add/edit hours → Month view → End-of-month submit popup → Locked month
                ↓
         Profile (feedback, logout)
```

### 1. Login
- Single field: **Nome** (display name only — no username/handle visible to user).
- Password field (can be placeholder for now).
- Primary button: **Entra**.
- Footer: “Hai dimenticato la password? Chiedi all’admin.”
- No signup complexity — feels like opening a simple diary.

### 2. Home — “Oggi” (default tab)
**Header:** Stacca logo + profile icon.

**Greeting block (top, friendly):**
- “Ciao, {firstName}” + today’s date in Italian (e.g. “Lunedì 2 giugno 2026”).
- **Daily touch:** one short line that changes each day — pick ONE of:
  - a **gentle joke** (Tuscan/workplace humor, never rude), OR
  - a **fun fact** about the day/season/vineyard work, OR
  - **weather for San Casciano in Val di Pesa** (icon + temp + one word e.g. “Soleggiato” / “Pioggia”) — mock data OK in prototype.
- Keep this block **one card, max 2 lines** — not a news feed.

**Today summary card (accent red):**
- Label: **OGGI**
- Big number: total hours today (e.g. **7,5** ore registrate)
- Badge: count of entries (e.g. “3 voci”)

**If no hours today:** friendly empty state — e.g. “Oggi è ancora vuoto — tocca **+** per metterci le ore.” (not scolding).

**Today’s entries list:**
- Each row: hours (large) | mansione | luogo | chevron → edit
- Tap row to edit; FAB **+** bottom-right to add.

**This month teaser:** card linking to Month tab — total hours + “Aperto” badge.

**Bottom nav (3 tabs):** Oggi | Mese | Profilo

### 3. Add / edit hours
- Fields: **Data** (date picker, default today), **Ore** (stepper + chips 2, 4, 3,5, 6, 8), **Mansione** (dropdown), **Luogo** (dropdown with group “Vigne” + “Altro”).
- Mansioni (alphabetical): Accapannatura, Cantina, Chiusura 1° Filo, Chiusura 2° Filo, Diradamento, Legatura Macchinetta, Legatura Salcio, Potatura, Pulizia, Sfogliatura, Stralciatura, Trattore, Vendemmia, Altro.
- Luoghi: long vineyard list (alphabetical) — use placeholders like “San Rocco”, “Doccia”, “Cantina”, “Officina”, etc. Use **San** not “S.”
- Optional note (textarea).
- Sticky bottom: **Salva voce** (primary). On edit: **Elimina voce** (ghost).
- No bottom nav on this screen — back arrow only.

### 4. Month — “Mese” (second tab)
**Header:** back optional; title area shows **calendar navigation** only (avoid duplicate month title).

**Calendar card (Dario-style inspiration):**
- Month grid Mon–Sun, dots on days with logged hours, tap day to filter list below.
- Prev/next month arrows.

**Month total card (red accent):** total hours. Badge: **Aperto** or **Inviato** (text only, no icon).

**Stats cards:**
- **Per mansione** — horizontal bars, hours per task.
- **Per luogo** — horizontal bars, hours per vineyard/site.

**Entries list:** grouped by day (date header + daily total + rows).

**End of month — critical UX:**
- When calendar month is “complete” or user opens Mese near month end, show **bottom sheet / modal**:
  - Title: **Inviare il mese?**
  - Body: “Stai per inviare **{total} ore** di {Month Year}. Dopo l’invio non potrai più modificare le voci.”
  - Primary: **Sì, invia** | Secondary: **Annulla**
- After success: month badge → **Inviato**, all entries read-only, **no resubmit button** (disabled or hidden).
- Show info callout before submit: “Invia solo a fine mese.”

### 5. Profile — “Profilo” (third tab)
Keep **minimal** — no avatar circle, no @username, no “Operaio” label.

- Greeting: **Ciao, {firstName}**
- **Account** section:
  - **Invia feedback** → simple form: multiline message + **Invia** (sends to admin email in production).
  - **Sincronizzazione:** “Online” (status text).
- **Esci** (logout) button.
- No version footer, no company tagline in footer.

## Interaction rules (must feel obvious)

- **Large touch targets** (min 44–56px).
- **One primary action per screen.**
- **Confirm destructive actions** (delete entry, submit month).
- **Offline queue**: save works without network (“Salvato sul telefono…”), badge “In attesa”, olive banner with pending count, auto-sync on `online`. Month submit still requires connection and empty queue.
- **No tables, no spreadsheets, no filters** — workers never see Google Sheets.

## Month lock rules (business logic for prototype)

- Worker can add/edit/delete entries only while month status = **Aperto**.
- **Invia mese** → status **Inviato** → all entries that month read-only forever (admin must unlock — out of scope for worker UI).
- Cannot send same month twice — if already **Inviato**, show locked banner: “Mese inviato il {date}. Sola lettura.”

## Google Sheets (admin — mention in prototype copy only)

On successful **Invia mese**, backend will append to Sheet tab **Log**:  
`user_name, month, total_hours, days_worked, submitted_at`  
plus flat log of all entries. Workers don’t see this — admin uses Sheet for payroll.

## Screens to generate (priority order)

1. Login  
2. Home / Oggi (with greeting + weather/joke card + empty state variant)  
3. Aggiungi ore  
4. Mese (calendar + stats + open month)  
5. Mese — confirm submit modal  
6. Mese — locked / inviato state  
7. Profilo + Invia feedback  

## Design references

- Warm agricultural mobile UI, similar density to a simple production diary app.
- Calendar month grid like a clean calendar app (not cluttered).
- Cards, FAB, bottom nav — familiar phone patterns.

## Out of scope for Lovable prototype

- Real Google Sheets OAuth (mock success toast is enough).
- Real weather API (mock San Casciano weather is fine).
- Payroll rules, overtime, GPS, clock-in/out timestamps.
- Admin dashboard.
- Multi-language.

## Success criteria

A field worker can open the app on a phone, understand **in 5 seconds** what to do today, log hours in **under 30 seconds**, review the month on a **calendar**, and **submit once** at month end with clear **locked** feedback — without training or a manual.
