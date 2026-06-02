import { fetchSanCascianoWeather } from "@/lib/weather";

export async function DailyInspiration() {
  const weather = await fetchSanCascianoWeather();
  if (!weather) return null;

  return (
    <section className="block">
      <div className="card weather-card">
        <div className="weather-card__row">
          <span className="weather-card__emoji" aria-hidden>
            {weather.emoji}
          </span>
          <div>
            <div className="weather-card__main">
              {weather.place} — {weather.tempC}°
            </div>
            <div className="weather-card__cond">{weather.label}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
