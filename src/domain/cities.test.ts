import { describe, expect, it } from 'vitest'
import { getCityConfig } from './cities'

describe('getCityConfig', () => {
  it('resolves the confirmed Barcelona config', () => {
    expect(getCityConfig('barcelona')).toEqual({
      citySlug: 'barcelona',
      timeZone: 'Europe/Madrid',
      latitude: 41.3851,
      longitude: 2.1734,
      radiusKm: 15,
    })
  })

  it('returns undefined for a city with no config, rather than inventing one', () => {
    expect(getCityConfig('atlantis')).toBeUndefined()
  })
})
