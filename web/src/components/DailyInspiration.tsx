import { dailyMessageFromWeather } from "@/lib/daily-message";
import { fetchSanCascianoWeather } from "@/lib/weather";

export async function DailyInspiration() {
  const weather = await fetchSanCascianoWeather();
  const msg = dailyMessageFromWeather(weather);

  return (
    <section className="block">
      <div className="card weather-card">
        {msg.type === "weather" ? (
          <div className="weather-card__row">
            <span className="weather-card__emoji" aria-hidden>
              {msg.icon}
            </span>
            <div>
              <div className="weather-card__main">San Casciano — {msg.t}°</div>
              <div className="weather-card__cond">{msg.w}</div>
            </div>
          </div>
        ) : (
          <div className="weather-card__alt">
            <span className="weather-card__emoji" aria-hidden>
              {msg.type === "joke" ? "😄" : "🍇"}
            </span>
            <p className="weather-card__text">{msg.text}</p>
          </div>
        )}
      </div>
    </section>
  );
}
