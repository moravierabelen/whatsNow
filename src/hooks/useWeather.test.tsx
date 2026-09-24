import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchOpenMeteoForecast } from '../providers/openMeteo/client'
import type { OpenMeteoForecastResponse } from '../providers/openMeteo/types'
import { useWeather, weatherQueryKey } from './useWeather'

vi.mock('../providers/openMeteo/client', () => ({
  fetchOpenMeteoForecast: vi.fn(),
}))

const mockedFetchOpenMeteoForecast = vi.mocked(fetchOpenMeteoForecast)

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function rawForecast(overrides: Partial<OpenMeteoForecastResponse> = {}): OpenMeteoForecastResponse {
  return {
    timezone: 'Europe/Madrid',
    current: { temperature_2m: 21.4, weather_code: 0 },
    daily: { sunrise: ['2026-09-23T07:39'], sunset: ['2026-09-23T19:47'] },
    ...overrides,
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('weatherQueryKey', () => {
  it('builds a key from the citySlug', () => {
    expect(weatherQueryKey('barcelona')).toEqual(['weather', 'barcelona'])
  })

  it('changes when citySlug changes', () => {
    expect(weatherQueryKey('barcelona')).not.toEqual(weatherQueryKey('madrid'))
  })
})

describe('useWeather', () => {
  it('resolves Barcelona coordinates/timezone and requests the forecast', async () => {
    mockedFetchOpenMeteoForecast.mockResolvedValue(rawForecast())

    renderHook(() => useWeather('barcelona'), { wrapper: createWrapper() })

    await waitFor(() => expect(mockedFetchOpenMeteoForecast).toHaveBeenCalledWith(41.3851, 2.1734, 'Europe/Madrid'))
  })

  it('exposes the mapped Weather once the request resolves', async () => {
    mockedFetchOpenMeteoForecast.mockResolvedValue(rawForecast())

    const { result } = renderHook(() => useWeather('barcelona'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({
      temperatureC: 21.4,
      condition: 'clear',
      sunrise: { utc: '2026-09-23T05:39:00.000Z', timeZone: 'Europe/Madrid' },
      sunset: { utc: '2026-09-23T17:47:00.000Z', timeZone: 'Europe/Madrid' },
    })
  })

  it('exposes an error state when the request rejects', async () => {
    mockedFetchOpenMeteoForecast.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useWeather('barcelona'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('exposes an error state when the response cannot be mapped', async () => {
    mockedFetchOpenMeteoForecast.mockResolvedValue(rawForecast({ timezone: '' }))

    const { result } = renderHook(() => useWeather('barcelona'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('does not request anything for an unsupported city', () => {
    const { result } = renderHook(() => useWeather('atlantis'), { wrapper: createWrapper() })

    expect(mockedFetchOpenMeteoForecast).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe('idle')
  })
})
