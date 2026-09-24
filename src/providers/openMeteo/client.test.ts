import { afterEach, describe, expect, it, vi } from 'vitest'
import { OpenMeteoRequestError, fetchOpenMeteoForecast } from './client'

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  })
}

function mockFetchError(status: number) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({}),
  })
}

describe('fetchOpenMeteoForecast', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requests the forecast endpoint with latitude/longitude/timezone attached', async () => {
    const fetchMock = mockFetchOk({})
    vi.stubGlobal('fetch', fetchMock)

    await fetchOpenMeteoForecast(41.3851, 2.1734, 'Europe/Madrid')

    const requestedUrl = fetchMock.mock.calls[0][0] as URL
    expect(requestedUrl.origin + requestedUrl.pathname).toBe('https://api.open-meteo.com/v1/forecast')
    expect(requestedUrl.searchParams.get('latitude')).toBe('41.3851')
    expect(requestedUrl.searchParams.get('longitude')).toBe('2.1734')
    expect(requestedUrl.searchParams.get('timezone')).toBe('Europe/Madrid')
  })

  it('requests only the variables we actually use', async () => {
    const fetchMock = mockFetchOk({})
    vi.stubGlobal('fetch', fetchMock)

    await fetchOpenMeteoForecast(41.3851, 2.1734, 'Europe/Madrid')

    const requestedUrl = fetchMock.mock.calls[0][0] as URL
    expect(requestedUrl.searchParams.get('current')).toBe('temperature_2m,weather_code')
    expect(requestedUrl.searchParams.get('daily')).toBe('sunrise,sunset')
    expect(requestedUrl.searchParams.get('forecast_days')).toBe('1')
  })

  it('does not attach any API key (Open-Meteo is keyless)', async () => {
    const fetchMock = mockFetchOk({})
    vi.stubGlobal('fetch', fetchMock)

    await fetchOpenMeteoForecast(41.3851, 2.1734, 'Europe/Madrid')

    const requestedUrl = fetchMock.mock.calls[0][0] as URL
    expect(requestedUrl.searchParams.has('apikey')).toBe(false)
    expect(requestedUrl.searchParams.has('key')).toBe(false)
  })

  it('returns the parsed JSON response on success', async () => {
    vi.stubGlobal('fetch', mockFetchOk({ timezone: 'Europe/Madrid' }))

    await expect(fetchOpenMeteoForecast(41.3851, 2.1734, 'Europe/Madrid')).resolves.toEqual({
      timezone: 'Europe/Madrid',
    })
  })

  it('throws an OpenMeteoRequestError on a non-successful HTTP response', async () => {
    vi.stubGlobal('fetch', mockFetchError(500))

    await expect(fetchOpenMeteoForecast(41.3851, 2.1734, 'Europe/Madrid')).rejects.toBeInstanceOf(
      OpenMeteoRequestError,
    )
  })
})
