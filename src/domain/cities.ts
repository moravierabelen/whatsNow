export interface CityConfig {
  citySlug: string
  timeZone: string
  latitude: number
  longitude: number
  radiusKm: number
}

export const DEFAULT_CITY_SLUG = 'barcelona'

const CITIES: Record<string, CityConfig> = {
  barcelona: {
    citySlug: 'barcelona',
    timeZone: 'Europe/Madrid',
    latitude: 41.3851,
    longitude: 2.1734,
    radiusKm: 15,
  },
}

export function getCityConfig(citySlug: string): CityConfig | undefined {
  return CITIES[citySlug]
}
