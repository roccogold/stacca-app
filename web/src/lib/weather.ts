/** San Casciano in Val di Pesa */
const LAT = 43.4028;
const LON = 11.186;
const PLACE = "San Casciano";

export type WeatherSnapshot = {
  tempC: number;
  label: string;
  emoji: string;
  place: string;
};

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

export async function fetchSanCascianoWeather(): Promise<WeatherSnapshot | null> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(LAT));
  url.searchParams.set("longitude", String(LON));
  url.searchParams.set("current", "temperature_2m,weather_code");
  url.searchParams.set("timezone", "Europe/Rome");

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 1800 },
    });
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
      place: PLACE,
    };
  } catch {
    return null;
  }
}
