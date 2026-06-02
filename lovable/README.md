# Lovable reference (read-only)

Cartella per il export GitHub del progetto Lovable. **Non è l’app che gira in produzione** — quella è in [`../web/`](../web/).

## Setup (una volta)

### 1. Collega Lovable a GitHub

1. Apri il progetto su [lovable.dev](https://lovable.dev)
2. **Settings → Git → GitHub** (oppure icona GitHub nell’editor)
3. Autorizza GitHub e installa la **Lovable GitHub App**
4. **Connect project** → Lovable crea un repo nuovo e fa sync automatico

Documentazione: [Connect to GitHub](https://docs.lovable.dev/integrations/github)

> Non rinominare o cancellare quel repo — si rompe il sync.

### 2. Clona qui dentro

Sostituisci `TUO-USER` e `TUO-REPO` con l’URL del repo creato da Lovable:

```bash
cd /Users/roccogoldschmidt/Desktop/Projects/proj-ore

# Prima volta (se la cartella è vuota tranne questo README):
git clone https://github.com/TUO-USER/TUO-REPO.git lovable/repo
```

### 3. Aggiungi al workspace Cursor

**File → Add Folder to Workspace…** → seleziona `proj-ore/lovable/repo`  
Così Cursor vede sia `web/` sia `lovable/` insieme.

### 4. Aggiorna dopo modifiche in Lovable

```bash
cd lovable/repo && git pull
```

Oppure: `npm run sync:lovable` dalla root del monorepo.

---

## Mappa file → app Next.js

| Lovable | Next.js (`web/`) |
|---------|------------------|
| `src/styles.css` | `src/app/globals.css` (token colori) |
| `src/components/BottomNav.tsx` | `src/components/BottomNav.tsx` |
| `src/components/AppShell.tsx` | `src/components/AppShell.tsx` |
| `src/components/StaccaLogo.tsx` | `src/components/StaccaLogo.tsx` |
| `src/routes/index.tsx` | `src/app/(main)/page.tsx` |
| `src/routes/mese.tsx` | `src/app/(main)/mese/page.tsx` |
| `src/routes/profilo.tsx` | `src/app/(main)/profilo/page.tsx` |
| `src/routes/aggiungi.tsx` | `src/app/(main)/aggiungi/` + `AggiungiForm.tsx` |
| `src/routes/login.tsx` | `src/app/login/` |

## Cosa **non** copiare

- `router.tsx`, `vite.config.ts`, TanStack Router
- `lib/stacca-store.ts` (noi: Prisma + iron-session)
- `components/ui/*` shadcn (solo se aggiungi Tailwind a Next)

## Brand

L’app si chiama **Stacca**. Logo in `web/public/stacca/`. Se Lovable ha ancora “Gino”, aggiorna anche lì o chiedi allineamento dopo `git pull`.

## Come chiedere allineamento in Cursor

```
Allinea web/src/app/(main)/page.tsx al layout in lovable/repo/src/routes/index.tsx
```

Oppure: `@lovable/repo/src/styles.css` nel messaggio.
