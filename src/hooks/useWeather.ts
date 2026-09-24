import { skipToken, useQuery } from '@tanstack/react-query'
import { getCityConfig } from '../domain/cities'
import { fetchOpenMeteoForecast } from '../providers/openMeteo/client'
import { mapOpenMeteoForecast } from '../providers/openMeteo/mapper'
import type { OpenMeteoForecastResponse } from '../providers/openMeteo/types'

/** Weather doesn't need to be fresher than this — avoids refetching on
 * every window refocus/component remount for data that barely moves. */
const STALE_TIME_MS = 15 * 60 * 1000

export function weatherQueryKey(citySlug: string) {
  return ['weather', citySlug] as const
}

/**
 * Resolves `citySlug` via the shared `domain/cities` config, same as the
 * event providers — an unsupported city disables the query (`skipToken`)
 * rather than fabricating coordinates.
 */
export function useWeather(citySlug: string) {
  const cityConfig = getCityConfig(citySlug)

  return useQuery({
    queryKey: weatherQueryKey(citySlug),
    queryFn: cityConfig
      ? async () => {
          const raw = (await fetchOpenMeteoForecast(
            cityConfig.latitude,
            cityConfig.longitude,
            cityConfig.timeZone,
          )) as OpenMeteoForecastResponse
          const weather = mapOpenMeteoForecast(raw)
          if (!weather) throw new Error('Could not parse the Open-Meteo forecast response')
          return weather
        }
      : skipToken,
    staleTime: STALE_TIME_MS,
  })
}
