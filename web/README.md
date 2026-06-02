# Setup

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

After `npm run db:seed`, check the terminal output for email + password (format `{handle}-{suffix}`).

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | Default `file:./dev.db` (SQLite under `prisma/`) |
| `SESSION_SECRET` | yes | 32+ characters ([iron-session](https://github.com/vvo/iron-session)) |
| `RESEND_API_KEY` | for email | [Resend](https://resend.com) API key — reset password + feedback |
| `EMAIL_FROM` | for email | Sender address. Test: `onboarding@resend.dev`. Production: `noreply@tuodominio.it` |
| `FEEDBACK_TO_EMAIL` | for feedback | Admin inbox for in-app feedback |

## Auth

- Login: **email + password** (each worker has a row in `prisma/seed.ts`)
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
3. Add all workers in `prisma/seed.ts` with their real emails → `npm run db:seed`

Free tier: 3,000 emails/month — enough for this app.

## Google Sheets — invio mese

1. [Google Cloud Console](https://console.cloud.google.com) → nuovo progetto (o esistente)
2. **APIs & Services → Library** → abilita **Google Sheets API**
3. **APIs & Services → Credentials → Create credentials → Service account**
4. Crea service account → **Keys → Add key → JSON** (salva il file)
5. Crea un **Google Sheet** con tab **Ore** (o cambia `GOOGLE_SHEETS_TAB`)
6. **Condividi** il foglio con l'email del service account (tipo `xxx@xxx.iam.gserviceaccount.com`) come **Editor**
7. In `web/.env`:
   ```
   GOOGLE_SHEETS_ID=   # dall'URL: docs.google.com/spreadsheets/d/QUESTO_ID/edit
   GOOGLE_SHEETS_TAB=Ore
   GOOGLE_SERVICE_ACCOUNT_EMAIL=...@....iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```
   (`private_key` dal JSON — tieni le `\n`)

Colonne scritte automaticamente: Data, Nome, Email, Ore, Mansione, Luogo, Note, Mese, Inviato il.

Dopo **Invia mese**: badge **Inviato**, voci in sola lettura, righe su Sheets.

## Scripts

- `npm run dev` — development
- `npm run build` — production build
- `npm run db:seed` — upsert workers from `prisma/seed.ts`
- `npm run db:migrate` — Prisma migrate

## Static mockups

HTML/CSS prototypes live in [`../mockups/`](../mockups/).

## Not implemented yet

- Deploy to Vercel + Postgres (Supabase)
