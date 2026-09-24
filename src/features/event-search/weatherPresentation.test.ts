import { CloudLightningIcon, CloudMoonIcon, CloudRainIcon, CloudSunIcon, MoonIcon, SnowflakeIcon, SunIcon } from '@phosphor-icons/react'
import { describe, expect, it } from 'vitest'
import type { Weather, WeatherCondition } from '../../domain/weather/weather'
import { formatSunset, isDaytime, shouldShowSunset, weatherConditionIcon } from './weatherPresentation'

function weather(overrides: Partial<Weather> = {}): Weather {
  return {
    temperatureC: 21,
    condition: 'clear',
    // Sunrise 07:39, sunset 20:34 local (Europe/Madrid), matching the real
    // shape confirmed during the Open-Meteo integration.
    sunrise: { utc: '2026-09-23T05:39:00.000Z', timeZone: 'Europe/Madrid' },
    sunset: { utc: '2026-09-23T18:34:00.000Z', timeZone: 'Europe/Madrid' },
    ...overrides,
  }
}

describe('shouldShowSunset', () => {
  it('does not show sunset well before the 3-hour window', () => {
    // 10:00 UTC, sunset at 18:34 UTC — 8h34 away.
    expect(shouldShowSunset(weather(), '2026-09-23T10:00:00.000Z')).toBe(false)
  })

  it('shows sunset exactly at the 3-hour boundary', () => {
    // 15:34 UTC -> exactly 3h before 18:34 UTC.
    expect(shouldShowSunset(weather(), '2026-09-23T15:34:00.000Z')).toBe(true)
  })

  it('shows sunset comfortably inside the window', () => {
    // 17:00 UTC -> 1h34 before sunset.
    expect(shouldShowSunset(weather(), '2026-09-23T17:00:00.000Z')).toBe(true)
  })

  it('shows sunset one minute before it happens', () => {
    expect(shouldShowSunset(weather(), '2026-09-23T18:33:00.000Z')).toBe(true)
  })

  it('does not show sunset once it has already passed', () => {
    expect(shouldShowSunset(weather(), '2026-09-23T18:35:00.000Z')).toBe(false)
  })
})

describe('formatSunset', () => {
  it('formats as "Sunset HH:mm" in the sunset local timezone', () => {
    // 18:34 UTC -> 20:34 CEST (Europe/Madrid, UTC+2 in September).
    expect(formatSunset(weather())).toBe('Sunset 20:34')
  })
})

describe('isDaytime', () => {
  it('is night before sunrise', () => {
    expect(isDaytime(weather(), '2026-09-23T04:00:00.000Z')).toBe(false)
  })

  it('is day at sunrise itself', () => {
    expect(isDaytime(weather(), '2026-09-23T05:39:00.000Z')).toBe(true)
  })

  it('is day between sunrise and sunset', () => {
    expect(isDaytime(weather(), '2026-09-23T12:00:00.000Z')).toBe(true)
  })

  it('is night at sunset itself', () => {
    expect(isDaytime(weather(), '2026-09-23T18:34:00.000Z')).toBe(false)
  })

  it('is night after sunset', () => {
    expect(isDaytime(weather(), '2026-09-23T21:00:00.000Z')).toBe(false)
  })
})

describe('weatherConditionIcon', () => {
  const DAY = '2026-09-23T12:00:00.000Z'
  const NIGHT = '2026-09-23T21:00:00.000Z'

  it.each([
    ['clear', DAY, SunIcon],
    ['clear', NIGHT, MoonIcon],
    ['partly-cloudy', DAY, CloudSunIcon],
    ['partly-cloudy', NIGHT, CloudMoonIcon],
    ['snow', DAY, SnowflakeIcon],
    ['snow', NIGHT, SnowflakeIcon],
    ['storm', DAY, CloudLightningIcon],
    ['storm', NIGHT, CloudLightningIcon],
  ] as const)('%s at %s -> the expected icon', (condition: WeatherCondition, referenceTime, expectedIcon) => {
    expect(weatherConditionIcon(weather({ condition }), referenceTime)).toBe(expectedIcon)
  })

  it('falls back to the day rain icon at night — Phosphor has no night-rain variant', () => {
    expect(weatherConditionIcon(weather({ condition: 'rain' }), NIGHT)).toBe(CloudRainIcon)
  })
})
