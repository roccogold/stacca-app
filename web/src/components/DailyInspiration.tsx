import { CuriositaText } from "@/components/CuriositaText";
import { getCuriositaForWeekCached } from "@/lib/curiosita-settimana";
import { fetchSanCascianoWeather } from "@/lib/weather";

export async function DailyInspiration() {
  const [weather, curiosita] = await Promise.all([
    fetchSanCascianoWeather(),
    getCuriositaForWeekCached(),
  ]);

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
        <div className="weather-card__detto">
          <span className="weather-card__detto-label">Lo sapevi?</span>
          <CuriositaText text={curiosita} />
        </div>
      </div>
    </section>
  );
}
