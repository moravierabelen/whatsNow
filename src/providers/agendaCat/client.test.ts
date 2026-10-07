import { afterEach, describe, expect, it, vi } from 'vitest'
import { AgendaCatRequestError, fetchAgendaCatEventByRowId, fetchAgendaCatEvents } from './client'

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(body) })
}

function mockFetchError(status: number, body: unknown = {}) {
  return vi.fn().mockResolvedValue({ ok: false, status, json: () => Promise.resolve(body) })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchAgendaCatEvents', () => {
  it('requests the dataset resource without credentials', async () => {
    const fetchMock = mockFetchOk([])
    vi.stubGlobal('fetch', fetchMock)

    await fetchAgendaCatEvents({})

    const url = fetchMock.mock.calls[0][0] as URL
    expect(url.origin + url.pathname).toBe(
      'https://analisi.transparenciacatalunya.cat/resource/rhpv-yr4f.json',
    )
    expect(fetchMock.mock.calls[0][1]).toBeUndefined()
  })

  it('always selects system fields, since Socrata omits :id otherwise', async () => {
    const fetchMock = mockFetchOk([])
    vi.stubGlobal('fetch', fetchMock)

    await fetchAgendaCatEvents({ $limit: '5' })

    const url = fetchMock.mock.calls[0][0] as URL
    expect(url.searchParams.get('$select')).toBe(':*,*')
    expect(url.searchParams.get('$limit')).toBe('5')
  })

  it('passes SoQL params through as given', async () => {
    const fetchMock = mockFetchOk([])
    vi.stubGlobal('fetch', fetchMock)

    await fetchAgendaCatEvents({ $where: "municipi='x'", $limit: '100' })

    const url = fetchMock.mock.calls[0][0] as URL
    expect(url.searchParams.get('$where')).toBe("municipi='x'")
  })

  it('throws with the status and Socrata error code on a failed request', async () => {
    vi.stubGlobal('fetch', mockFetchError(400, { errorCode: 'query.soql.no-such-column' }))

    await expect(fetchAgendaCatEvents({})).rejects.toMatchObject({
      name: 'AgendaCatRequestError',
      status: 400,
      errorCode: 'query.soql.no-such-column',
    })
  })

  it('still throws when the error body cannot be parsed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.reject(new Error('nope')) }),
    )

    await expect(fetchAgendaCatEvents({})).rejects.toBeInstanceOf(AgendaCatRequestError)
  })
})

describe('fetchAgendaCatEventByRowId', () => {
  it('filters on the row id', async () => {
    const fetchMock = mockFetchOk([])
    vi.stubGlobal('fetch', fetchMock)

    await fetchAgendaCatEventByRowId('row-g22r~zyvk~dtba')

    const url = fetchMock.mock.calls[0][0] as URL
    expect(url.searchParams.get('$where')).toBe(":id='row-g22r~zyvk~dtba'")
  })

  it.each([
    ["x' OR 1=1 --", 'could break out of the SoQL literal'],
    ['row-inexistente', 'is free-form, which :id answers with a 400 rather than no rows'],
    ['', 'is empty'],
  ])('treats %s as not found, without requesting: it %s', async (rowId) => {
    const fetchMock = mockFetchOk([])
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchAgendaCatEventByRowId(rowId)

    expect(result).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
