# proj-ore — Stacca (ore in vigna)

- **`web/`** — production Next.js app: login, oggi, aggiungi ore, mese (calendario + statistiche), profilo, **invio feedback** (email con Resend se configurato).
- **`lovable/`** — reference UI cloned from Lovable GitHub (see [lovable/README.md](lovable/README.md)).
- **`mockups/`** — static HTML/CSS reference and early layouts.

## Quick start

See [web/README.md](web/README.md).

```bash
cd web && cp .env.example .env && npm install && npx prisma migrate dev && npm run dev
```

Then open `/login`.

## Lovable as UI reference

1. Connect project on Lovable → GitHub ([docs](https://docs.lovable.dev/integrations/github))
2. Clone into `lovable/` — full steps in [lovable/README.md](lovable/README.md)
3. In Cursor: **Add Folder to Workspace** → `lovable/`
4. Update: `npm run sync:lovable`
5. Ask: *“allinea home a lovable”* (or any screen)
