import { unstable_cache } from "next/cache";

/** Area Corzano e Paterno — comune San Casciano in Val di Pesa (FI) */
const LAT = 43.4028;
const LON = 11.186;
const PLACE_FALLBACK = "San Casciano in Val di Pesa";

/** ~3 fetch al giorno: slot da 8 ore (00–07, 08–15, 16–23 ora di Roma) */
const WEATHER_SLOT_HOURS = 8;

export type WeatherSnapshot = {
  tempC: number;
  label: string;
  emoji: string;
  place: string;
};

function romeWeatherSlotId(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number.parseInt(get("hour"), 10);
  const slot = Math.floor(hour / WEATHER_SLOT_HOURS);

  return `${get("year")}-${get("month")}-${get("day")}-s${slot}`;
}

function labelFromCode(code: number): { label: string; emoji: string } {
  if (code === 0) return { label: "Sereno", emoji: "☀️" };
  if (code <= 3) return { label: "Nuvoloso", emoji: "⛅" };
  if (code <= 48) return { label: "Nebbia", emoji: "🌫️" };
  if (code <= 57) return { label: "Pioggerella", emoji: "🌦️" };
  if (code <= 67) return { label: "Pioggia", emoji: "🌧️" };
  if (code <= 77) return { label: "Neve", emoji: "❄️" };
  if (code <= 82) return { label: "Rovesci", emoji: "🌧️" };
  if (code <= 86) return { label: "Neve", emoji: "❄️" };
  if (code >= 95) return { label: "Temporale", emoji: "⛈️" };
  return { label: "Variabile", emoji: "🌤️" };
}

async function fetchPlaceNameRaw(): Promise<string> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", PLACE_FALLBACK);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "it");
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return PLACE_FALLBACK;

    const data = (await res.json()) as {
      results?: { name?: string }[];
    };
    return data.results?.[0]?.name?.trim() || PLACE_FALLBACK;
  } catch {
    return PLACE_FALLBACK;
  }
}

const fetchPlaceName = unstable_cache(fetchPlaceNameRaw, ["weather-place-name"], {
  revalidate: 60 * 60 * 24 * 7,
});

async function fetchSanCascianoWeatherRaw(): Promise<WeatherSnapshot | null> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(LAT));
  url.searchParams.set("longitude", String(LON));
  url.searchParams.set("current", "temperature_2m,weather_code");
  url.searchParams.set("timezone", "Europe/Rome");

  try {
    const [res, place] = await Promise.all([
      fetch(url.toString(), { cache: "no-store" }),
      fetchPlaceName(),
    ]);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };
    const temp = data.current?.temperature_2m;
    const code = data.current?.weather_code ?? 0;
    if (temp === undefined) return null;

    const { label, emoji } = labelFromCode(code);
    return {
      tempC: Math.round(temp),
      label,
      emoji,
      place,
    };
  } catch {
    return null;
  }
}

export async function fetchSanCascianoWeather(): Promise<WeatherSnapshot | null> {
  const slot = romeWeatherSlotId();

  return unstable_cache(
    fetchSanCascianoWeatherRaw,
    ["weather-san-casciano", slot],
    { revalidate: WEATHER_SLOT_HOURS * 60 * 60 },
  )();
}
