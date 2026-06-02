import { getDettoForDate } from "@/lib/detti";
import type { WeatherSnapshot } from "@/lib/weather";

export type DailyMessage =
  | { type: "weather"; icon: string; t: number; w: string }
  | { type: "fact"; text: string }
  | { type: "joke"; text: string };

const FACTS = [
  "Lo sapevi? Una vite ben curata può vivere oltre 100 anni.",
  "In Toscana si vendemmia di solito tra fine agosto e ottobre.",
  "Il Sangiovese prende il nome dal 'sangue di Giove'.",
  "Una bottiglia di vino contiene circa 600 acini d'uva.",
];

const JOKES = [
  "Le viti non si lamentano mai del lunedì.",
  "Una potatura fatta bene vale più di mille parole.",
  "Il miglior trattore è quello che parte al primo colpo.",
  "Ricorda: prima il caffè, poi la vigna.",
];

export function dailyMessageKind(d = new Date()): number {
  const doy = Math.floor(
    (d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  return doy % 3;
}

export function dailyMessageFromWeather(
  weather: WeatherSnapshot | null,
  d = new Date(),
): DailyMessage {
  const kind = dailyMessageKind(d);
  if (kind === 0 && weather) {
    return {
      type: "weather",
      icon: weather.emoji,
      t: weather.tempC,
      w: weather.label,
    };
  }
  if (kind === 1) {
    const doy = Math.floor(
      (d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000,
    );
    return { type: "fact", text: FACTS[doy % FACTS.length]! };
  }
  return { type: "joke", text: getDettoForDate(d) };
}
