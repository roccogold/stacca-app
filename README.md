# Stacca — registro ore in vigna

App mobile-first per operai di Corzano e Paterno.

| Cartella | Cosa fa |
|----------|---------|
| **`web/`** | App vera (Next.js + Prisma) — **questa la deployi** |
| **`lovable/repo/`** | Copia locale del design Lovable — **solo riferimento, non la modifichi a mano** |
| **`mockups/`** | HTML statici early-stage |

## Quick start

```bash
cd web && cp .env.example .env && npm install && npx prisma migrate dev && npm run dev
```

Apri `/login`. Dettagli in [web/README.md](web/README.md).

---

## Workflow (come lavori tu)

```
┌─────────────────────────────────────────────────────────┐
│  stacca-app (GitHub)  ←  il TUO progetto, push qui      │
│  web/ · mockups/ · docs                                 │
└─────────────────────────────────────────────────────────┘
         ▲
         │  git push (ogni tuo cambio)
         │
    proj-ore/  (questa cartella)


┌─────────────────────────────────────────────────────────┐
│  stacca-lovable (GitHub)  ←  solo design Lovable          │
│  Lovable pusha qui in automatico quando modifichi lì    │
└─────────────────────────────────────────────────────────┘
         │
         │  npm run sync:lovable  (quando Lovable ha cambiato)
         ▼
    lovable/repo/  (copia locale per confronto)
         │
         │  chiedi a Cursor: "allinea X a lovable"
         ▼
    web/  (porti layout/CSS/copy nel codice vero)
```

### In pratica

1. **Sviluppi e pushi** solo **`stacca-app`** — tutto ciò che conta (backend, logiche, deploy).
2. **Su Lovable** fai prove di UI/design → finisce da sola su **`stacca-lovable`**.
3. Quando ti piace qualcosa su Lovable:
   ```bash
   npm run sync:lovable
   ```
4. Mi chiedi, ad esempio:
   - *"Lovable ha cambiato la home — allinea `web/`"*
   - *"Copia il nuovo stile del calendario da lovable"*

Io leggo `lovable/repo/`, porto **solo UI** in `web/` (non router, non store Lovable).

### Cosa non fare

- Non editare `lovable/repo/` a mano — al prossimo sync si sovrascrive.
- Non aspettarti che Lovable aggiorni `web/` da solo — il passaggio lo facciamo noi su richiesta.
- Non mischiare le due repo in una sola (Lovable sovrascriverebbe il codice Next.js).

---

## GitHub

| Repo | Ruolo |
|------|--------|
| **[stacca-app](https://github.com/roccogold/stacca-app)** | Progetto principale — **creala e pusha qui** |
| **[stacca-lovable](https://github.com/roccogold/stacca-lovable)** | Export Lovable — collegata in Lovable Settings → Git |

Dopo aver creato `stacca-app` (repo vuota, private):

```bash
git push -u origin main
```

(`origin` è già configurato su `stacca-app`.)
