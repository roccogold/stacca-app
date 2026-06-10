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
2. Fill in real `firstName`, `lastName`, `email`, `suffix` (and optional `role: "admin"`)
3. Run `npm run db:seed` — **new** workers get demo password `{handle}-{suffix}`; existing workers keep their password (only name/email/role updated)

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
| `SMTP_HOST` | for email | SMTP server — es. `smtp.gmail.com` |
| `SMTP_PORT` | for email | `587` (STARTTLS) o `465` (SSL) |
| `SMTP_USER` | for email | Indirizzo casella / Gmail (è anche il mittente) |
| `SMTP_PASS` | for email | Password casella / **App Password** Gmail |
| `FEEDBACK_TO_EMAIL` | for feedback | Admin inbox for in-app feedback |

## Auth

- Login: **email + password** (each worker has a row in `prisma/workers.local.ts`)
- First login: forced password change
- Forgot password: 6-digit code via email (vedi **Invio email** sotto)

### Invio email (reset password + feedback)

Le email partono via **SMTP** (`src/lib/email.ts`) — nessun provider esterno. Setup con **Gmail**: Account Google → **Sicurezza** → attiva **Verifica in due passaggi** → **Password per le app** → genera (16 caratteri). In `web/.env`:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=roccogold23@gmail.com
SMTP_PASS=<app password 16 caratteri>   # NON la password normale di Gmail
```
Mittente mostrato: `Stacca <SMTP_USER>`. Limite Gmail ~500 email/giorno. Se le `SMTP_*` non sono configurate, il recupero via email non parte: usa il fallback admin (**Rigenera password** dal tab Admin). Per un mittente professionale `@corzanoepaterno.it`: verifica un (sotto)dominio sul provider SMTP e cambia solo le variabili — il codice non cambia.

### Ruoli: dipendente / admin

Ogni utente ha un `role` (`dipendente` di default, oppure `admin`).

- **Dipendente** — vede solo Oggi, Mese, Profilo (le proprie ore).
- **Admin** — in più vede il tab **Admin**: lista (admin in cima, poi alfabetico) con **ricerca** per nome/email; crea, modifica (nome/cognome/email/ruolo), **disattiva/riattiva** e rigenera la password temporanea degli account. I disattivati sono raccolti in una sezione richiudibile. Non vede le ore altrui.

Un nuovo dipendente creato dal tab admin riceve una **password temporanea mostrata una sola volta**: consegnala alla persona, che la cambia al primo accesso (`mustChangePassword`). Stessa cosa per **Rigenera password**.

**Disattiva non elimina dati**: blocca solo il login (le ore e i mesi inviati restano nel DB e su Google Sheets). Un utente disattivato non può accedere; puoi **riattivarlo** in qualsiasi momento.

**Nessuna eliminazione dei dati** (GDPR / conservazione): non esiste un'azione che cancella ore o mesi — i dati restano **per sempre**, sia nel DB che su Google Sheets. L'azione più forte è **Disattiva** (blocca l'accesso). I disattivati vengono nascosti nella sezione richiudibile "Disattivati" per non ingombrare la lista.

Su un disattivato puoi fare **swipe a sinistra → Elimina** per **rimuoverlo dalla lista** (flag `archived`, stessa UI delle lavorazioni): sparisce dalla vista admin ma **tutti i dati restano** (record utente, ore, mesi, Google Sheets). È archiviazione, non cancellazione — recuperabile dal DB se serve. Le card sono **comprimibili**: si toccano per aprire le azioni.

**Account protetto:** l'email in `PROTECTED_ADMIN_EMAIL` (default `roccogold23@gmail.com`) è il titolare e **non può essere modificata, disattivata o resettata da altri admin** — solo dal titolare stesso. Gli altri admin vedono i pulsanti disabilitati (e le API rispondono 403).

Guardrail: deve restare **almeno un amministratore attivo** (non puoi declassare/disattivare l'ultimo admin) e non puoi disattivare il tuo stesso account.

**Promuovere un admin** (dev: via `workers.local.ts` `role: "admin"` + `db:seed`; produzione: dopo il deploy):

```bash
npm run db:promote-admin -- cantina@corzanoepaterno.it
```

Idempotente: imposta `role = admin` per quell'email (l'utente deve già esistere — esegui prima `db:seed`).

## Convenzioni schema (Prisma / Postgres)

Da rispettare quando si aggiungono modelli o campi (vedi anche l'header in [`prisma/schema.prisma`](prisma/schema.prisma)):

| Elemento | Convenzione | Esempi |
|----------|-------------|--------|
| Tabelle (model) | **PascalCase, singolare** | `User`, `TimeEntry`, `MonthSubmission` |
| Colonne (field) | **camelCase** | `displayName`, `totalHours`, `createdAt` |
| Chiave primaria | `id` (cuid) | |
| Chiave esterna | `<model>Id` | `userId` |
| Timestamp | `createdAt` / `updatedAt`, o evento al passato | `submittedAt` |
| Enum | tipo PascalCase, valori minuscoli | `UserRole { admin, dipendente }` |
| Lingua | **inglese** di default | `firstName`, `passwordHash` |

**Eccezioni volute (non "correggere"):** alcuni termini di dominio restano in **italiano** per combaciare con la UI e il foglio paghe — `mansione` (task), `luogo` (site) in `TimeEntry`, e il valore ruolo `dipendente`. `_prisma_migrations` è una tabella interna di Prisma e si lascia com'è.

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

Update `web/.env` with the two Supabase URLs + keep existing SMTP/Google vars.

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
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Gmail address (also the sender) |
| `SMTP_PASS` | Gmail **App Password** |
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
- `npm run db:promote-admin -- <email>` — set a user's role to `admin`
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
