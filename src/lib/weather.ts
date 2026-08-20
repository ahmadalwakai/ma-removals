export interface WeatherForecast {
  condition: "clear" | "clouds" | "rain" | "heavy_rain" | "snow" | "storm";
  description: string;
  temperature: number;
  icon: string;
}

const WEATHER_API_KEY = process.env.OPENWEATHERMAP_API_KEY;

export async function getWeatherForecast(
  lat: number,
  lng: number,
  targetDate: Date
): Promise<WeatherForecast> {
  const fallback: WeatherForecast = { condition: "clear", description: "No forecast", temperature: 12, icon: "☀️" };

  if (!WEATHER_API_KEY) return fallback;

  const now = new Date();
  const daysAhead = Math.floor((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysAhead > 5) return { ...fallback, description: "Forecast unavailable" };

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${WEATHER_API_KEY}&units=metric`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return fallback;

    const data = await res.json() as { list: Array<{ dt: number; weather: Array<{ id: number; description: string }>; main: { temp: number } }> };

    // Find forecast closest to target date at noon
    const targetNoon = new Date(targetDate);
    targetNoon.setHours(12, 0, 0, 0);
    const targetTs = targetNoon.getTime() / 1000;

    let closest = data.list[0]!;
    let closestDiff = Infinity;
    for (const entry of data.list) {
      const diff = Math.abs(entry.dt - targetTs);
      if (diff < closestDiff) { closestDiff = diff; closest = entry; }
    }

    const id = closest.weather[0]!.id;
    const temp = Math.round(closest.main.temp);
    const desc = closest.weather[0]!.description;

    let condition: WeatherForecast["condition"] = "clear";
    let icon = "☀️";
    if      (id >= 200 && id < 300)             { condition = "storm";      icon = "⛈️"; }
    else if (id >= 300 && id < 400)             { condition = "rain";       icon = "🌦️"; }
    else if (id >= 500 && id < 502)             { condition = "rain";       icon = "🌧️"; }
    else if (id >= 502 && id < 600)             { condition = "heavy_rain"; icon = "🌧️"; }
    else if (id >= 600 && id < 700)             { condition = "snow";       icon = "❄️"; }
    else if (id >= 801)                         { condition = "clouds";     icon = "☁️"; }

    return { condition, description: desc, temperature: temp, icon };
  } catch {
    return fallback;
  }
}

export function getWeatherSurchargeKey(condition: string): string | null {
  switch (condition) {
    case "rain":       return "weather_rain_surcharge";
    case "heavy_rain": return "weather_heavy_rain";
    case "snow":       return "weather_snow_surcharge";
    case "storm":      return "weather_storm_surcharge";
    default:           return null;
  }
}
