# Lovable — solo riferimento design

Questa cartella **non è l’app in produzione**. L’app vera è in [`../web/`](../web/).

Lovable sincronizza in automatico su GitHub:

**https://github.com/roccogold/stacca-lovable**

## Setup (una volta)

```bash
git clone https://github.com/roccogold/stacca-lovable.git lovable/repo
```

## Aggiornare dopo modifiche su Lovable

Dalla root del progetto:

```bash
npm run sync:lovable
```

Se hai rinominato la repo su GitHub, aggiorna anche il remote locale:

```bash
git -C lovable/repo remote set-url origin https://github.com/roccogold/stacca-lovable.git
```

Poi chiedi in Cursor: *“allinea [schermata] a lovable”*.

## Cosa copiare in `web/`

| Lovable | Next.js |
|---------|---------|
| `src/routes/index.tsx` | `web/src/app/(main)/page.tsx` |
| `src/routes/mese.tsx` | `web/src/app/(main)/mese/page.tsx` |
| `src/routes/profilo.tsx` | `web/src/components/ProfiloClient.tsx` |
| `src/routes/aggiungi.tsx` | `web/src/components/AggiungiForm.tsx` |
| `src/routes/login.tsx` | `web/src/app/login/page.tsx` |
| `src/styles.css` | `web/src/app/globals.css` |
| `src/components/StaccaLogo.tsx` | `web/src/components/StaccaLogo.tsx` |

## Cosa **non** copiare

- `lib/stacca-store.ts` (noi: Prisma + sessioni)
- TanStack Router, Vite, `components/ui/*` shadcn
