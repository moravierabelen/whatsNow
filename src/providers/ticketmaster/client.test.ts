import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TicketmasterRequestError, fetchTicketmasterEvents } from './client'

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

describe('fetchTicketmasterEvents', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_TICKETMASTER_API_KEY', 'test-api-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('requests the Discovery API events endpoint with the API key attached', async () => {
    const fetchMock = mockFetchOk({})
    vi.stubGlobal('fetch', fetchMock)

    await fetchTicketmasterEvents({})

    const requestedUrl = fetchMock.mock.calls[0][0] as URL
    expect(requestedUrl.origin + requestedUrl.pathname).toBe(
      'https://app.ticketmaster.com/discovery/v2/events.json',
    )
    expect(requestedUrl.searchParams.get('apikey')).toBe('test-api-key')
  })

  it('includes the given query parameters in the request URL', async () => {
    const fetchMock = mockFetchOk({})
    vi.stubGlobal('fetch', fetchMock)

    await fetchTicketmasterEvents({ city: 'Barcelona', countryCode: 'ES' })

    const requestedUrl = fetchMock.mock.calls[0][0] as URL
    expect(requestedUrl.searchParams.get('city')).toBe('Barcelona')
    expect(requestedUrl.searchParams.get('countryCode')).toBe('ES')
  })

  it('returns the parsed JSON response on success', async () => {
    vi.stubGlobal('fetch', mockFetchOk({ page: { totalElements: 3 } }))

    await expect(fetchTicketmasterEvents({})).resolves.toEqual({ page: { totalElements: 3 } })
  })

  it('throws a TicketmasterRequestError on a non-successful HTTP response', async () => {
    vi.stubGlobal('fetch', mockFetchError(500))

    await expect(fetchTicketmasterEvents({})).rejects.toBeInstanceOf(TicketmasterRequestError)
  })

  it('throws a clear error when the API key is not configured, without calling fetch', async () => {
    vi.stubEnv('VITE_TICKETMASTER_API_KEY', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchTicketmasterEvents({})).rejects.toBeInstanceOf(TicketmasterRequestError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
