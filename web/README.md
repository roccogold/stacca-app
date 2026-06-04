# Stacca — developer guide

Project overview, screenshots, and brand story: **[../README.md](../README.md)**.

## Setup

```bash
cd web
cp .env.example .env
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login).

## Demo login (seed)

1. Copy `prisma/workers.example.ts` → `prisma/workers.local.ts` (gitignored)
2. Fill in real emails and suffixes
3. Run `npm run db:seed` — **new** workers get demo password `{handle}-{suffix}`; existing workers keep their password (only name/email updated)

Never commit `workers.local.ts`.

**Forgot password (admin reset):**

```bash
npm run db:reset-password -- arianna
```

Prints the temporary demo password; worker must change it on next login.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | Supabase **Transaction pooler** (port 6543, `?pgbouncer=true`) |
| `DIRECT_URL` | yes | Supabase **Direct** connection (port 5432) — used for migrations |
| `SESSION_SECRET` | yes | 32+ characters ([iron-session](https://github.com/vvo/iron-session)) |
| `RESEND_API_KEY` | for email | [Resend](https://resend.com) API key — reset password + feedback |
| `EMAIL_FROM` | for email | Sender address. Test: `onboarding@resend.dev`. Production: `noreply@tuodominio.it` |
| `FEEDBACK_TO_EMAIL` | for feedback | Admin inbox for in-app feedback |

## Auth

- Login: **email + password** (each worker has a row in `prisma/workers.local.ts`)
- First login: forced password change
- Forgot password: 6-digit code via email (needs `RESEND_API_KEY`)

### Resend — test (now)

1. Create a free account at [resend.com](https://resend.com) (use `roccogold23@gmail.com`)
2. **API Keys** → Create API Key → copy `re_...`
3. In `web/.env`:
   ```
   RESEND_API_KEY=re_xxxxxxxx
   EMAIL_FROM=onboarding@resend.dev
   FEEDBACK_TO_EMAIL=roccogold23@gmail.com
   ```
4. Restart `npm run dev`
5. Test: **Password dimenticata?** → `roccogold23@gmail.com` → code arrives in Gmail

With `onboarding@resend.dev`, Resend only delivers to the email you used to sign up.

### Resend — production (20 workers)

1. **Domains** → Add `corzanoepaterno.com` (or your domain) → add DNS records
2. Set `EMAIL_FROM=noreply@corzanoepaterno.com`
3. Add all workers in `prisma/workers.local.ts` → `npm run db:seed`

Free tier: 3,000 emails/month — enough for this app.

## Google Sheets — invio mese

1. [Google Cloud Console](https://console.cloud.google.com) → nuovo progetto (o esistente)
2. **APIs & Services → Library** → abilita **Google Sheets API**
3. **APIs & Services → Credentials → Create credentials → Service account**
4. Crea service account → **Keys → Add key → JSON** (salva il file)
5. Crea un **Google Sheet** con tab **Ore Totali** (log grezzo; i tab **Presenze …** per dipendente vengono creati automaticamente all’invio mese)
6. **Condividi** il foglio con l'email del service account (tipo `xxx@xxx.iam.gserviceaccount.com`) come **Editor**
7. In `web/.env` (local) or Vercel env (production):
   ```
   GOOGLE_SHEETS_ID=   # dall'URL: docs.google.com/spreadsheets/d/QUESTO_ID/edit
   GOOGLE_SHEETS_TAB=Ore Totali
   GOOGLE_SERVICE_ACCOUNT_JSON=./google-service-account.json   # local only
   ```
   On **Vercel**, use either the full JSON inline in `GOOGLE_SERVICE_ACCOUNT_JSON`, or:
   ```
   GOOGLE_SERVICE_ACCOUNT_EMAIL=...@....iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

Colonne tab **Ore Totali** (log grezzo dall’app): Data, Nome, Email, Ore (testo), **Ore (h)** (numero per pivot), Lavorazione, Luogo, Note, Mese, Registrato il, Tipo, **ID**.

- **Ogni salvataggio** → riga `Tipo` = **Voce** (una riga per lavoro; colonna **ID** = id voce in app).
- **Modifica / elimina** in app → aggiorna o rimuove la stessa riga su Sheet (per **ID**; righe vecchie senza ID ancora aggiornabili se data/lavorazione/luogo/ore coincidono).
- **Invia mese** → riga `Tipo` = **Chiusura** su **Ore Totali** + stato **Chiuso** sul tab presenze.

### Tab **Presenze [Nome]** (foglio standard, un tab per dipendente)

Creato/aggiornato **ad ogni salvataggio ore** (nome tab: `Presenze Rocco`, ecc.). Formato semplice per segretaria / portale paghe:

- Prime righe: **Azienda**, **Dipendente**
- Poi **una riga per ogni lavorazione** (come in app): Data, Giorno, Ore (h), Lavorazione, Luogo, Note, Mese, Stato (`Bozza` / `Chiuso`)

Niente righe duplicate (Intestazione / Giorno / Riepilogo / Voce). Se registri 6 ore in un solo lavoro → **1 riga** su Presenze.

**Ore Totali** resta il log tecnico completo (ogni voce + ID + chiusura mese). **Presenze** è il foglio “da ufficio”.

**Backfill** tab presenze (dopo deploy o dati già presenti):

```bash
npm run sheets:sync-presenze
```

### Analisi su **Ore Totali** (pivot, opzionale)

Per analisi grezze o pivot su tutti i dipendenti, usa ancora **Ore Totali** (`Tipo` = `Voce`, valori **SUM Ore (h)**).

Condividi il foglio in sola lettura con chi fa contabilità; il service account resta **Editor** solo per l’app.

## Deploy — Supabase + Vercel

### 1. Supabase

1. [supabase.com](https://supabase.com) → **New project** (name: `stacca`, region: EU)
2. Save the database password
3. **Project Settings → Database → Connection string**
4. Copy **Transaction pooler** → `DATABASE_URL` (port **6543**, add `?pgbouncer=true` if missing)
5. Copy **Direct connection** → `DIRECT_URL` (port **5432**)

### 2. Local `.env`

Update `web/.env` with the two Supabase URLs + keep existing Resend/Google vars.

Run migrations and seed:

```bash
cd web
npx prisma migrate deploy
npm run db:seed
npm run dev
```

### 3. Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → import `roccogold/stacca-app`
2. **Root Directory:** `web`
3. **Environment variables** (Production):

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Supabase transaction pooler (6543) |
| `DIRECT_URL` | Supabase direct (5432) |
| `SESSION_SECRET` | New random string (`openssl rand -base64 32`) |
| `RESEND_API_KEY` | Your Resend key |
| `EMAIL_FROM` | `onboarding@resend.dev` (or verified domain) |
| `FEEDBACK_TO_EMAIL` | Admin email |
| `GOOGLE_SHEETS_ID` | Sheet ID |
| `GOOGLE_SHEETS_TAB` | `Ore Totali` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | From JSON `client_email` |
| `GOOGLE_PRIVATE_KEY` | From JSON `private_key` (keep `\n`) |

4. **Deploy** — build runs `prisma migrate deploy` automatically
5. Seed production DB once from your machine:

```bash
cd web
DATABASE_URL="..." DIRECT_URL="..." npm run db:seed
```

### 4. Test

Open the Vercel URL → login → add entries → **Invia mese** → check Google Sheet.

## Scripts

- `npm run dev` — development
- `npm run build` — production build
- `npm run db:seed` — add/update workers from `prisma/workers.local.ts` (password unchanged for existing)
- `npm run db:reset-password -- <handle>` — reset one worker to demo password
- `npm run db:clear-data` — delete all entries + month submissions + sheet data rows (keeps users)
- `npm run sheets:clear-user -- <handle>` — remove one worker’s rows from Google Sheets
- `npm run sheets:sync-presenze` — rebuild all **Presenze [Nome]** tabs from DB submissions
- `npm run db:migrate` — Prisma migrate

## Security checklist (GitHub / ops)

- Never commit `.env`, `google-service-account.json`, or `prisma/workers.local.ts` (all gitignored).
- On GitHub: enable **Secret scanning** and **Dependabot alerts** for the repo.
- Production **must** set a unique `SESSION_SECRET` (32+ chars) on Vercel — the app refuses the dev fallback in production.
- Rotate Supabase DB password if credentials were shared outside the team.

## Static mockups

HTML/CSS prototypes live in [`../mockups/`](../mockups/).
