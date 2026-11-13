export interface DailyForecast {
  /** Local date at the trail, YYYY-MM-DD. */
  date: string;
  weathercode: number | null;
  tempMaxC: number | null;
  tempMinC: number | null;
  precipProbability: number | null;
  snowfallCm: number | null;
}

export interface WeatherData {
  temperature: number;
  windspeed: number;
  weathercode: number;
  is_day: boolean;
  /** Height of the forecast point in metres (close to the trailhead). */
  elevation?: number | null;
  /** Local hour at the trail when fetched (0–23). */
  localHour?: number | null;
  /** Today and tomorrow at the trailhead. */
  daily?: DailyForecast[];
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Open-Meteo's daily block, column-wise → one object per day. Tolerates missing columns. */
export function parseDaily(daily: any): DailyForecast[] {
  const dates: unknown[] = Array.isArray(daily?.time) ? daily.time : [];
  return dates
    .map((date, i) => ({
      date: String(date),
      weathercode: num(daily.weather_code?.[i]),
      tempMaxC: num(daily.temperature_2m_max?.[i]),
      tempMinC: num(daily.temperature_2m_min?.[i]),
      precipProbability: num(daily.precipitation_probability_max?.[i]),
      snowfallCm: num(daily.snowfall_sum?.[i]),
    }))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date));
}

// Open-Meteo API (free, no API key needed)
export const weatherService = {
  async getCurrentWeather(lat: number, lng: number): Promise<WeatherData> {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true` +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,snowfall_sum' +
      '&forecast_days=2&timezone=auto';
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to fetch weather');
    }

    const data = await response.json();
    const cw = data.current_weather;
    // current_weather.time is local to the trail (timezone=auto), e.g. "2026-11-14T13:15"
    const hourText = String(cw?.time ?? '').slice(11, 13);
    const hour = /^\d{2}$/.test(hourText) ? Number(hourText) : null;

    return {
      temperature: cw.temperature,
      windspeed: cw.windspeed,
      weathercode: cw.weathercode,
      is_day: cw.is_day === 1,
      elevation: num(data.elevation),
      localHour: hour !== null && hour < 24 ? hour : null,
      daily: parseDaily(data.daily),
    };
  },
};

// WMO weather codes → label + icon
export function getWeatherInfo(code: number): { label: string; icon: string } {
  if (code === 0) return { label: 'Clear sky', icon: 'sunny-outline' };
  if (code <= 3) return { label: 'Partly cloudy', icon: 'partly-sunny-outline' };
  if (code <= 48) return { label: 'Fog', icon: 'cloud-outline' };
  if (code <= 55) return { label: 'Drizzle', icon: 'rainy-outline' };
  if (code <= 57) return { label: 'Freezing drizzle', icon: 'snow-outline' };
  if (code <= 65) return { label: 'Rain', icon: 'rainy-outline' };
  if (code <= 67) return { label: 'Freezing rain', icon: 'snow-outline' };
  if (code <= 77) return { label: 'Snow', icon: 'snow-outline' };
  if (code <= 82) return { label: 'Rain showers', icon: 'rainy-outline' };
  if (code <= 86) return { label: 'Snow showers', icon: 'snow-outline' };
  if (code === 95) return { label: 'Thunderstorm', icon: 'thunderstorm-outline' };
  if (code <= 99) return { label: 'Thunderstorm + hail', icon: 'thunderstorm-outline' };
  return { label: 'Unknown', icon: 'cloud-outline' };
}
