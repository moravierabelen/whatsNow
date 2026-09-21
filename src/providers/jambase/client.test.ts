import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JamBaseRequestError, fetchJamBaseEventById, fetchJamBaseEvents } from './client'

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  })
}

function mockFetchError(status: number, body: unknown = {}) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  })
}

describe('fetchJamBaseEvents', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_JAMBASE_API_KEY', 'test-api-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('requests the events endpoint with a Bearer authorization header', async () => {
    const fetchMock = mockFetchOk({})
    vi.stubGlobal('fetch', fetchMock)

    await fetchJamBaseEvents({})

    const requestedUrl = fetchMock.mock.calls[0][0] as URL
    const requestOptions = fetchMock.mock.calls[0][1] as { headers: Record<string, string> }
    expect(requestedUrl.origin + requestedUrl.pathname).toBe('https://api.data.jambase.com/v3/events')
    expect(requestOptions.headers.Authorization).toBe('Bearer test-api-key')
  })

  it('includes the given query parameters in the request URL', async () => {
    const fetchMock = mockFetchOk({})
    vi.stubGlobal('fetch', fetchMock)

    await fetchJamBaseEvents({ geoLatitude: '41.3851', geoLongitude: '2.1734' })

    const requestedUrl = fetchMock.mock.calls[0][0] as URL
    expect(requestedUrl.searchParams.get('geoLatitude')).toBe('41.3851')
    expect(requestedUrl.searchParams.get('geoLongitude')).toBe('2.1734')
  })

  it('returns the parsed JSON response on success', async () => {
    vi.stubGlobal('fetch', mockFetchOk({ success: true, events: [] }))

    await expect(fetchJamBaseEvents({})).resolves.toEqual({ success: true, events: [] })
  })

  it('throws a JamBaseRequestError on a non-successful HTTP response', async () => {
    vi.stubGlobal('fetch', mockFetchError(500))

    await expect(fetchJamBaseEvents({})).rejects.toBeInstanceOf(JamBaseRequestError)
  })

  it('attaches the error code from the response body when present', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchError(400, { success: false, errors: [{ code: 'invalid_parameter', message: 'bad radius' }] }),
    )

    await expect(fetchJamBaseEvents({})).rejects.toMatchObject({ status: 400, code: 'invalid_parameter' })
  })

  it('throws a clear error when the API key is not configured, without calling fetch', async () => {
    vi.stubEnv('VITE_JAMBASE_API_KEY', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchJamBaseEvents({})).rejects.toBeInstanceOf(JamBaseRequestError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('fetchJamBaseEventById', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_JAMBASE_API_KEY', 'test-api-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('requests the single-event endpoint with the jambase: prefix and Bearer auth', async () => {
    const fetchMock = mockFetchOk({ success: true, event: {} })
    vi.stubGlobal('fetch', fetchMock)

    await fetchJamBaseEventById('16937270')

    const requestedUrl = fetchMock.mock.calls[0][0] as URL
    const requestOptions = fetchMock.mock.calls[0][1] as { headers: Record<string, string> }
    expect(requestedUrl.toString()).toBe('https://api.data.jambase.com/v3/events/id/jambase:16937270')
    expect(requestOptions.headers.Authorization).toBe('Bearer test-api-key')
  })

  it('attaches the identifier_invalid error code for a not-found lookup', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchError(400, {
        success: false,
        errors: [{ code: 'identifier_invalid', message: 'No event found for `jambase` event id `9999999999999`' }],
      }),
    )

    await expect(fetchJamBaseEventById('9999999999999')).rejects.toMatchObject({
      status: 400,
      code: 'identifier_invalid',
    })
  })
})
