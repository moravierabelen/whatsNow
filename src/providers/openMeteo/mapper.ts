import { TZDate } from '@date-fns/tz'
import type { Weather, WeatherCondition } from '../../domain/weather/weather'
import type { OpenMeteoForecastResponse } from './types'

/**
 * WMO weather codes (Open-Meteo's `weather_code`), collapsed to our small
 * internal `WeatherCondition` set. Grouped by what they'd actually look
 * like to someone glancing at the header, not by WMO's own subcategories
 * (e.g. drizzle/rain/rain-showers all become "rain").
 *   0          -> clear
 *   1, 2       -> partly-cloudy (mainly clear / partly cloudy)
 *   3          -> cloudy (overcast)
 *   45, 48     -> fog
 *   51-57      -> rain (drizzle, incl. freezing)
 *   61-67      -> rain
 *   80-82      -> rain (showers)
 *   71-77      -> snow
 *   85, 86     -> snow (showers)
 *   95, 96, 99 -> storm (thunderstorm, incl. with hail)
 */
const WEATHER_CODE_TO_CONDITION: Record<number, WeatherCondition> = {
  0: 'clear',
  1: 'partly-cloudy',
  2: 'partly-cloudy',
  3: 'cloudy',
  45: 'fog',
  48: 'fog',
  51: 'rain',
  53: 'rain',
  55: 'rain',
  56: 'rain',
  57: 'rain',
  61: 'rain',
  63: 'rain',
  65: 'rain',
  66: 'rain',
  67: 'rain',
  71: 'snow',
  73: 'snow',
  75: 'snow',
  77: 'snow',
  80: 'rain',
  81: 'rain',
  82: 'rain',
  85: 'snow',
  86: 'snow',
  95: 'storm',
  96: 'storm',
  99: 'storm',
}

/** `null` for an unrecognized code, rather than guessing a fallback condition. */
export function mapWeatherCode(code: number): WeatherCondition | null {
  return WEATHER_CODE_TO_CONDITION[code] ?? null
}

function toUtcInstant(localNaive: string | undefined, timeZone: string): string | null {
  if (!localNaive) return null
  const time = new TZDate(localNaive, timeZone).getTime()
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

export function mapOpenMeteoForecast(raw: OpenMeteoForecastResponse): Weather | null {
  try {
    const timeZone = raw.timezone
    if (!timeZone) return null

    const condition = mapWeatherCode(raw.current.weather_code)
    if (!condition) return null

    const sunriseUtc = toUtcInstant(raw.daily.sunrise[0], timeZone)
    const sunsetUtc = toUtcInstant(raw.daily.sunset[0], timeZone)
    if (!sunriseUtc || !sunsetUtc) return null

    return {
      temperatureC: raw.current.temperature_2m,
      condition,
      sunrise: { utc: sunriseUtc, timeZone },
      sunset: { utc: sunsetUtc, timeZone },
    }
  } catch {
    return null
  }
}
