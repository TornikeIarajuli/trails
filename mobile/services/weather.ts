export interface WeatherData {
  temperature: number;
  windspeed: number;
  weathercode: number;
  is_day: boolean;
}

// Open-Meteo API (free, no API key needed)
export const weatherService = {
  async getCurrentWeather(lat: number, lng: number): Promise<WeatherData> {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to fetch weather');
    }

    const data = await response.json();
    const cw = data.current_weather;

    return {
      temperature: cw.temperature,
      windspeed: cw.windspeed,
      weathercode: cw.weathercode,
      is_day: cw.is_day === 1,
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
