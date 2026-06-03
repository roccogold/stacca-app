/** Lavorazioni — ordine alfabetico, Altro in fondo. */
export const MANSIONI = [
  "Accapannatura",
  "Cantina",
  "Chiusura 1° Filo",
  "Chiusura 2° Filo",
  "Diradamento",
  "Legatura Macchinetta",
  "Legatura Salcio",
  "Potatura",
  "Pulizia",
  "Sfogliatura",
  "Stralciatura",
  "Trattore",
  "Vendemmia",
  "Altro",
] as const;

export const LUOGHI_VIGNE = [
  "Anfiteatro Lato Bosco",
  "Anfiteatro Nuovo Lato Corzanello",
  "Cabernet Piaggia",
  "Capraio F9",
  "Capraio R23",
  "Dietro Corzanello",
  "Doccia",
  "F9",
  "La Chiesa",
  "Luigi",
  "Merlot Pecore",
  "Muretto",
  "San Rocco",
  "San Vito Cabernet",
  "San Vito Sangiovese Piaggia",
  "San Vito Sangiovese Piano",
  "Sassaio M",
  "Sassaio Semillon",
  "Sassaio SG",
  "Sopra Doccia",
  "Sorbigliano",
  "Strada",
  "Traliccio",
  "Trebbiano",
  "VDM",
  "Vigna Alta Nuova",
  "Vigna Del Fosso",
  "Vigna Grande Cana",
  "Vigna Grande Nuova (Tre Borri)",
  "Altro",
] as const;

export const LUOGHI_ALTRO = ["Cantina", "Magazzino", "Officina", "Ufficio", "Altro"] as const;

export const LUOGHI = [...LUOGHI_VIGNE, ...LUOGHI_ALTRO] as const;

/** Quick-pick hours for common farm shifts (manual entry mode). */
export const HOUR_CHIPS = [2, 4, 6, 8] as const;

/** Quick-pick break durations (flexible stepper can go beyond 60). */
export const BREAK_PRESETS = [
  { minutes: 0, label: "0" },
  { minutes: 15, label: "15m" },
  { minutes: 30, label: "30m" },
  { minutes: 45, label: "45m" },
  { minutes: 60, label: "1h" },
] as const;
