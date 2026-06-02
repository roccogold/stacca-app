# Stacca — registro ore

Next.js app for **registro ore** (Corzano e Paterno): workers log hours by date, mansione, and luogo; month view with **calendar grid** and breakdowns; **feedback** to admin email via [Resend](https://resend.com).

## Setup

```bash
cd web
cp .env.example .env
# Edit .env: SESSION_SECRET (32+ chars), optional RESEND_API_KEY + FEEDBACK_TO_EMAIL
npm install
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login), choose a **nome utente** (handle) and optional **nome da mostrare**. Password is not validated yet (demo).

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | Default `file:./dev.db` (SQLite under `prisma/`) |
| `SESSION_SECRET` | yes | 32+ characters ([iron-session](https://github.com/vvo/iron-session)) |
| `RESEND_API_KEY` | for feedback | Resend API key |
| `FEEDBACK_TO_EMAIL` | for feedback | Your inbox |
| `FEEDBACK_FROM_EMAIL` | optional | Verified sender (e.g. `onboarding@resend.dev`) |

## Scripts

- `npm run dev` — development
- `npm run build` — production build (`prisma generate` + `next build`)
- `npm run db:migrate` — Prisma migrate

## Static mockups

HTML/CSS prototypes live in [`../mockups/`](../mockups/) (same visual language; the app in `web/` is the runnable version).

## Next steps (not implemented here)

- Google Sheets sync / export for admin
- Real password auth and roles
- “Invia mese” lock workflow
