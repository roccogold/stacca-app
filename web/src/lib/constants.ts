/** Mansione options (same list as original mockups). */
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
  "Anfi Nuovo Lato Corzanello",
  "Anfiteatro Lato Bosco",
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
] as const;

export const LUOGHI_ALTRO = ["Cantina", "Officina", "Altro"] as const;

export const LUOGHI = [...LUOGHI_VIGNE, ...LUOGHI_ALTRO] as const;

export const HOUR_CHIPS = [2, 3.5, 4, 6, 8] as const;
