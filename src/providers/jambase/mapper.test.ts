import { describe, expect, it } from 'vitest'
import { encodeEventId } from '../../domain/events/eventId'
import { mapJamBaseEvent } from './mapper'
import type { JamBaseEvent } from './types'

function baseEvent(overrides: Partial<JamBaseEvent> = {}): JamBaseEvent {
  return {
    identifier: 'jambase:16309935',
    name: 'Fritz Kalkbrenner at SEASEACLUB',
    url: 'https://www.jambase.com/show/fritz-kalkbrenner-go-beach-club-barcelona-20260919',
    image: 'https://www.jambase.com/wp-content/uploads/fritz-kalkbrenner.jpg',
    startDate: '2026-09-19T16:30:00',
    endDate: '2026-09-19',
    location: {
      name: 'SEASEACLUB',
      address: {
        streetAddress: '14P Carrer del Port Esportiu',
        addressLocality: 'Barcelona',
        'x-timezone': 'Europe/Madrid',
      },
      geo: { latitude: 41.4138, longitude: 2.2293 },
    },
    offers: [
      {
        url: 'https://link.dice.fm/xe95d6dc4cdf?utm_source=jambase',
        category: 'ticketingLinkPrimary',
        priceSpecification: {},
      },
      {
        url: 'https://stubhub.example/fritz-kalkbrenner',
        category: 'ticketingLinkSecondary',
        priceSpecification: { minPrice: 30, maxPrice: 60, priceCurrency: 'USD' },
      },
    ],
    performer: [{ genre: ['edm'] }],
    ...overrides,
  }
}

describe('mapJamBaseEvent', () => {
  it('maps a complete real-shaped event', () => {
    const result = mapJamBaseEvent(baseEvent())

    expect(result).toEqual({
      id: encodeEventId({ provider: 'jambase', externalId: '16309935' }),
      source: { provider: 'jambase', externalId: '16309935' },
      name: 'Fritz Kalkbrenner at SEASEACLUB',
      category: 'music',
      start: { utc: '2026-09-19T14:30:00.000Z', timeZone: 'Europe/Madrid', timeKnown: true },
      end: undefined,
      endDate: undefined,
      venue: {
        name: 'SEASEACLUB',
        coordinates: { latitude: 41.4138, longitude: 2.2293 },
        address: '14P Carrer del Port Esportiu',
        city: 'Barcelona',
      },
      url: 'https://link.dice.fm/xe95d6dc4cdf?utm_source=jambase',
      image: { url: 'https://www.jambase.com/wp-content/uploads/fritz-kalkbrenner.jpg' },
      priceRange: undefined,
    })
  })

  it('generates an opaque domain id via encodeEventId, not the raw identifier', () => {
    const result = mapJamBaseEvent(baseEvent())

    expect(result?.id).toBe(encodeEventId({ provider: 'jambase', externalId: '16309935' }))
    expect(result?.id).not.toContain('jambase:16309935')
  })

  it('strips the "jambase:" prefix from externalId', () => {
    const result = mapJamBaseEvent(baseEvent())

    expect(result?.source.externalId).toBe('16309935')
  })

  it('rejects an identifier with an unexpected prefix', () => {
    const result = mapJamBaseEvent(baseEvent({ identifier: 'ticketmaster:16309935' }))

    expect(result).toBeNull()
  })

  it('rejects an identifier with no id after the prefix', () => {
    const result = mapJamBaseEvent(baseEvent({ identifier: 'jambase:' }))

    expect(result).toBeNull()
  })

  it('always maps category to music, regardless of genre', () => {
    expect(mapJamBaseEvent(baseEvent({ performer: [{ genre: ['edm'] }] }))?.category).toBe('music')
    expect(mapJamBaseEvent(baseEvent({ performer: [{ genre: [] }] }))?.category).toBe('music')
    expect(mapJamBaseEvent(baseEvent({ performer: [] }))?.category).toBe('music')
    expect(mapJamBaseEvent(baseEvent({ performer: undefined }))?.category).toBe('music')
  })

  it('maps the top-level image URL, without width/height (JamBase never gives dimensions)', () => {
    const result = mapJamBaseEvent(baseEvent())

    expect(result?.image).toEqual({ url: 'https://www.jambase.com/wp-content/uploads/fritz-kalkbrenner.jpg' })
  })

  it('leaves image undefined when the raw event has none', () => {
    const result = mapJamBaseEvent(baseEvent({ image: undefined }))

    expect(result?.image).toBeUndefined()
  })

  it('leaves image undefined for an unusable image URL, rather than passing it through', () => {
    const result = mapJamBaseEvent(baseEvent({ image: 'not-a-url' }))

    expect(result?.image).toBeUndefined()
  })

  it('converts a naive local startDate + IANA timezone into the correct UTC instant', () => {
    const result = mapJamBaseEvent(baseEvent({ startDate: '2026-09-19T23:59:00' }))

    // 23:59 CEST (+2) -> 21:59 UTC
    expect(result?.start).toEqual({ utc: '2026-09-19T21:59:00.000Z', timeZone: 'Europe/Madrid', timeKnown: true })
  })

  it('conserves a date-only startDate (no time component), anchored to local midnight, marked timeKnown: false', () => {
    const result = mapJamBaseEvent(baseEvent({ startDate: '2026-09-25' }))

    expect(result).not.toBeNull()
    // Local midnight in Europe/Madrid (CEST, UTC+2) on 2026-09-25 -> 2026-09-24T22:00 UTC.
    // Previously this was misparsed as UTC midnight (2026-09-25T00:00Z), i.e. 02:00 local — a fabricated time.
    expect(result?.start).toEqual({ utc: '2026-09-24T22:00:00.000Z', timeZone: 'Europe/Madrid', timeKnown: false })
  })

  it('still maps a startDate with a real time component as timeKnown: true, unaffected by the date-only handling', () => {
    const result = mapJamBaseEvent(baseEvent({ startDate: '2026-09-19T16:30:00' }))

    expect(result?.start).toEqual({ utc: '2026-09-19T14:30:00.000Z', timeZone: 'Europe/Madrid', timeKnown: true })
  })

  it('never derives Event.end from endDate, even when endDate is present', () => {
    const result = mapJamBaseEvent(baseEvent({ endDate: '2026-09-19' }))

    expect(result?.end).toBeUndefined()
  })

  it('rejects an event with no startDate', () => {
    const result = mapJamBaseEvent(baseEvent({ startDate: undefined }))

    expect(result).toBeNull()
  })

  it('rejects an event with no venue timezone', () => {
    const result = mapJamBaseEvent(
      baseEvent({
        location: {
          name: 'SEASEACLUB',
          geo: { latitude: 41.4138, longitude: 2.2293 },
        },
      }),
    )

    expect(result).toBeNull()
  })

  it('rejects an event with no venue name', () => {
    const result = mapJamBaseEvent(
      baseEvent({
        location: {
          address: { 'x-timezone': 'Europe/Madrid' },
          geo: { latitude: 41.4138, longitude: 2.2293 },
        },
      }),
    )

    expect(result).toBeNull()
  })

  it('rejects an event with out-of-range coordinates instead of defaulting to 0', () => {
    const result = mapJamBaseEvent(
      baseEvent({
        location: {
          name: 'SEASEACLUB',
          address: { 'x-timezone': 'Europe/Madrid' },
          geo: { latitude: 200, longitude: 2.2293 },
        },
      }),
    )

    expect(result).toBeNull()
  })

  it('rejects an event with missing coordinates', () => {
    const result = mapJamBaseEvent(
      baseEvent({
        location: {
          name: 'SEASEACLUB',
          address: { 'x-timezone': 'Europe/Madrid' },
        },
      }),
    )

    expect(result).toBeNull()
  })

  it('prefers the primary ticketing offer for both url and price', () => {
    const result = mapJamBaseEvent(
      baseEvent({
        offers: [
          { url: 'https://secondary.example', category: 'ticketingLinkSecondary', priceSpecification: { price: 99, priceCurrency: 'USD' } },
          { url: 'https://primary.example', category: 'ticketingLinkPrimary', priceSpecification: { price: 25, priceCurrency: 'EUR' } },
        ],
      }),
    )

    expect(result?.url).toBe('https://primary.example')
    expect(result?.priceRange).toEqual({ currency: 'EUR', min: 25, max: 25 })
  })

  it('falls back to the first usable offer when there is no primary', () => {
    const result = mapJamBaseEvent(
      baseEvent({
        offers: [
          { url: 'https://secondary-a.example', category: 'ticketingLinkSecondary', priceSpecification: {} },
          { url: 'https://secondary-b.example', category: 'ticketingLinkSecondary', priceSpecification: {} },
        ],
      }),
    )

    expect(result?.url).toBe('https://secondary-a.example')
  })

  it('falls back to the top-level url when no offer has a usable URL', () => {
    const result = mapJamBaseEvent(baseEvent({ offers: [] }))

    expect(result?.url).toBe('https://www.jambase.com/show/fritz-kalkbrenner-go-beach-club-barcelona-20260919')
  })

  it('rejects an event with neither a usable offer URL nor a usable top-level URL', () => {
    const result = mapJamBaseEvent(baseEvent({ offers: [], url: undefined }))

    expect(result).toBeNull()
  })

  it('leaves priceRange undefined when priceSpecification has no currency, rather than treating it as free', () => {
    const result = mapJamBaseEvent(
      baseEvent({
        offers: [{ url: 'https://primary.example', category: 'ticketingLinkPrimary', priceSpecification: {} }],
      }),
    )

    expect(result?.priceRange).toBeUndefined()
  })

  it('leaves endDate undefined when it matches startDate\'s own local date (not a real range)', () => {
    const result = mapJamBaseEvent(baseEvent({ startDate: '2026-09-19T16:30:00', endDate: '2026-09-19' }))

    expect(result?.endDate).toBeUndefined()
  })

  it('carries endDate through, unmodified, when it differs from startDate\'s local date', () => {
    const result = mapJamBaseEvent(baseEvent({ startDate: '2026-09-19T16:30:00', endDate: '2026-09-21' }))

    expect(result?.endDate).toBe('2026-09-21')
    // Still never a fabricated end instant — only a real end *time* would justify `end`.
    expect(result?.end).toBeUndefined()
  })

  it('leaves endDate undefined when the raw event has none', () => {
    const result = mapJamBaseEvent(baseEvent({ endDate: undefined }))

    expect(result?.endDate).toBeUndefined()
  })

  it('preserves endDate for a genuinely multi-day, date-only festival listing (the "Be Prog! My Friend" case)', () => {
    const result = mapJamBaseEvent(baseEvent({ startDate: '2026-09-25', endDate: '2026-09-26' }))

    expect(result?.start).toEqual({ utc: '2026-09-24T22:00:00.000Z', timeZone: 'Europe/Madrid', timeKnown: false })
    expect(result?.endDate).toBe('2026-09-26')
  })
})
