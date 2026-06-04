/**
 * Applica freeze + filtri sul tab Ore Totali (senza toccare i dati).
 *   npm run sheets:ore-totali-layout
 */
import { applyOreTotaliTabLayout, ensureSheetHeader } from "../src/lib/google-sheets";

async function main() {
  await ensureSheetHeader();
  await applyOreTotaliTabLayout();
  console.log("✓ Ore Totali — riga 1 bloccata, filtri attivi");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
