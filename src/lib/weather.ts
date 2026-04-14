export interface WeatherData {
  temp: number;
  feelsLike: number;
  description: string;
  humidity: number;
  windSpeed: number;
  icon: string; // e.g. '01d'
  city: string;
}

// Cape Town coords — hardcoded for now (user is Cape Town based)
const CAPE_TOWN = { lat: -33.9249, lon: 18.4241 };

export async function getWeather(): Promise<WeatherData | null> {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return null;
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${CAPE_TOWN.lat}&lon=${CAPE_TOWN.lon}&appid=${key}&units=metric`;
    const res = await fetch(url, { next: { revalidate: 1800 } }); // cache 30 min
    if (!res.ok) return null;
    const d = await res.json();
    return {
      temp: Math.round(d.main.temp),
      feelsLike: Math.round(d.main.feels_like),
      description: d.weather[0].description,
      humidity: d.main.humidity,
      windSpeed: Math.round(d.wind.speed),
      icon: d.weather[0].icon,
      city: d.name,
    };
  } catch {
    return null;
  }
}

export function weatherEmoji(icon: string): string {
  if (icon.startsWith('01')) return '☀️';
  if (icon.startsWith('02')) return '⛅';
  if (icon.startsWith('03') || icon.startsWith('04')) return '☁️';
  if (icon.startsWith('09') || icon.startsWith('10')) return '🌧️';
  if (icon.startsWith('11')) return '⛈️';
  if (icon.startsWith('13')) return '❄️';
  if (icon.startsWith('50')) return '🌫️';
  return '🌤️';
}

export function weatherToContext(w: WeatherData): string {
  return `Cape Town weather: ${w.temp}°C, feels like ${w.feelsLike}°C, ${w.description}, humidity ${w.humidity}%, wind ${w.windSpeed} m/s`;
}
