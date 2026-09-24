import { TZDate } from '@date-fns/tz'
import { format } from 'date-fns'
import {
  CloudFogIcon,
  CloudIcon,
  CloudLightningIcon,
  CloudMoonIcon,
  CloudRainIcon,
  CloudSunIcon,
  MoonIcon,
  SnowflakeIcon,
  SunIcon,
} from '@phosphor-icons/react'
import type { Weather, WeatherCondition } from '../../domain/weather/weather'

/**
 * Presentation-only weather logic (icon selection, sunset visibility) —
 * deliberately outside `domain/weather` and the Open-Meteo mapper, which
 * know nothing about icons, day/night, or display windows. `referenceTime`
 * is always explicit here, never read from the system clock, same rule as
 * the rest of this codebase (see `domain/events/temporal.ts`).
 */

const SUNSET_WINDOW_MS = 3 * 60 * 60 * 1000

/** `sunrise <= referenceTime < sunset` — day/night is a presentation
 * concept derived from real timestamps, not a `WeatherCondition` value. */
export function isDaytime(weather: Weather, referenceTime: string): boolean {
  const reference = new Date(referenceTime).getTime()
  const sunrise = new Date(weather.sunrise.utc).getTime()
  const sunset = new Date(weather.sunset.utc).getTime()
  return reference >= sunrise && reference < sunset
}

/** True only inside the 3-hour window before sunset, up to and including
 * the sunset instant itself — false once it's actually passed. */
export function shouldShowSunset(weather: Weather, referenceTime: string): boolean {
  const reference = new Date(referenceTime).getTime()
  const sunset = new Date(weather.sunset.utc).getTime()
  const msUntilSunset = sunset - reference
  return msUntilSunset >= 0 && msUntilSunset <= SUNSET_WINDOW_MS
}

/** "Sunset 20:34", in the sunset's own timezone. Only call when
 * `shouldShowSunset` is true. */
export function formatSunset(weather: Weather): string {
  const zoned = new TZDate(weather.sunset.utc, weather.sunset.timeZone)
  return `Sunset ${format(zoned, 'HH:mm')}`
}

export const DAY_CONDITION_ICON: Record<WeatherCondition, typeof SunIcon> = {
  clear: SunIcon,
  'partly-cloudy': CloudSunIcon,
  cloudy: CloudIcon,
  fog: CloudFogIcon,
  rain: CloudRainIcon,
  snow: SnowflakeIcon,
  storm: CloudLightningIcon,
}

/** Phosphor has no dedicated night-rain icon — `rain` reuses the day icon
 * rather than inventing a combination the library doesn't offer. */
export const NIGHT_CONDITION_ICON: Record<WeatherCondition, typeof SunIcon> = {
  clear: MoonIcon,
  'partly-cloudy': CloudMoonIcon,
  cloudy: CloudIcon,
  fog: CloudFogIcon,
  rain: CloudRainIcon,
  snow: SnowflakeIcon,
  storm: CloudLightningIcon,
}

/** The condition icon, aware of both `WeatherCondition` and whether it's
 * currently day or night at the forecast's own sunrise/sunset. */
export function weatherConditionIcon(weather: Weather, referenceTime: string): typeof SunIcon {
  const table = isDaytime(weather, referenceTime) ? DAY_CONDITION_ICON : NIGHT_CONDITION_ICON
  return table[weather.condition]
}
