/**
 * Crea/aggiorna il tab "Statistiche" (dashboard con grafici Stacca) sul foglio
 * Google. Idempotente: si può rilanciare per rigenerare il layout.
 *   npm run sheets:statistiche
 */
import { applyStatisticheTab } from "../src/lib/statistiche-sheet";

async function main() {
  const res = await applyStatisticheTab();
  if (!res.ok) {
    console.error("✗ Errore:", res.error);
    process.exit(1);
  }
  if (res.skipped) {
    console.log("• Saltato: Google Sheets non configurato (GOOGLE_SHEETS_ID / credenziali).");
    return;
  }
  console.log(
    '✓ Tab "Statistiche" pronto — filtri Anno/Mese/Dipendente, 5 grafici e tabelle riepilogo.',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
