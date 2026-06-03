import { fetchSanCascianoWeather } from "@/lib/weather";

export async function DailyInspiration() {
  const weather = await fetchSanCascianoWeather();

  if (!weather) return null;

  return (
    <div className="card weather-card">
      <div className="weather-card__row">
        <span className="weather-card__emoji" aria-hidden>
          {weather.emoji}
        </span>
        <div>
          <div className="weather-card__main">{weather.place}</div>
          <div className="weather-card__cond">
            {weather.tempC}° {weather.label}
          </div>
        </div>
      </div>
    </div>
  );
}
