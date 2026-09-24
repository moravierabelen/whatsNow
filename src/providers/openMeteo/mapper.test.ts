import { describe, expect, it } from 'vitest'
import { mapOpenMeteoForecast, mapWeatherCode } from './mapper'
import type { OpenMeteoForecastResponse } from './types'

describe('mapWeatherCode', () => {
  it.each([
    [0, 'clear'],
    [1, 'partly-cloudy'],
    [2, 'partly-cloudy'],
    [3, 'cloudy'],
    [45, 'fog'],
    [48, 'fog'],
    [55, 'rain'],
    [65, 'rain'],
    [80, 'rain'],
    [71, 'snow'],
    [85, 'snow'],
    [95, 'storm'],
    [99, 'storm'],
  ] as const)('maps WMO code %i to %s', (code, expected) => {
    expect(mapWeatherCode(code)).toBe(expected)
  })

  it('returns null for an unrecognized code, rather than guessing', () => {
    expect(mapWeatherCode(12345)).toBeNull()
  })
})

// Shaped after a real response captured during the spike for this task.
function rawForecast(overrides: Partial<OpenMeteoForecastResponse> = {}): OpenMeteoForecastResponse {
  return {
    timezone: 'Europe/Madrid',
    current: { temperature_2m: 27.7, weather_code: 0 },
    daily: { sunrise: ['2026-09-23T07:39'], sunset: ['2026-09-23T19:47'] },
    ...overrides,
  }
}

describe('mapOpenMeteoForecast', () => {
  it('maps a complete real-shaped response', () => {
    const result = mapOpenMeteoForecast(rawForecast())

    expect(result).toEqual({
      temperatureC: 27.7,
      condition: 'clear',
      // 07:39 local (Europe/Madrid, CEST = UTC+2) -> 05:39 UTC
      sunrise: { utc: '2026-09-23T05:39:00.000Z', timeZone: 'Europe/Madrid' },
      // 19:47 local -> 17:47 UTC
      sunset: { utc: '2026-09-23T17:47:00.000Z', timeZone: 'Europe/Madrid' },
    })
  })

  it('returns null when timezone is missing', () => {
    const result = mapOpenMeteoForecast(rawForecast({ timezone: '' }))

    expect(result).toBeNull()
  })

  it('returns null for an unrecognized weather code, rather than guessing a condition', () => {
    const result = mapOpenMeteoForecast(rawForecast({ current: { temperature_2m: 20, weather_code: 12345 } }))

    expect(result).toBeNull()
  })

  it('returns null when sunrise is missing', () => {
    const result = mapOpenMeteoForecast(rawForecast({ daily: { sunrise: [], sunset: ['2026-09-23T19:47'] } }))

    expect(result).toBeNull()
  })

  it('returns null when sunset is missing', () => {
    const result = mapOpenMeteoForecast(rawForecast({ daily: { sunrise: ['2026-09-23T07:39'], sunset: [] } }))

    expect(result).toBeNull()
  })
})
