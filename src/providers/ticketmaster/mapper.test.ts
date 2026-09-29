import { describe, expect, it } from 'vitest'
import { encodeEventId } from '../../domain/events/eventId'
import { mapTicketmasterEvent } from './mapper'
import type { TicketmasterEvent } from './types'

function baseEvent(overrides: Partial<TicketmasterEvent> = {}): TicketmasterEvent {
  return {
    id: 'tm-123',
    name: 'Test Concert',
    url: 'https://www.ticketmaster.es/event/test-concert',
    dates: {
      start: { dateTime: '2026-09-18T19:00:00Z', localDate: '2026-09-18', localTime: '21:00:00' },
      end: { dateTime: '2026-09-18T22:00:00Z' },
      timezone: 'Europe/Madrid',
      spanMultipleDays: false,
    },
    classifications: [{ primary: true, segment: { name: 'Music' }, genre: { name: 'Rock' } }],
    images: [{ url: 'https://img/16x9.jpg', width: 1024, height: 576, ratio: '16_9' }],
    priceRanges: [{ currency: 'EUR', min: 20, max: 50 }],
    _embedded: {
      venues: [
        {
          name: 'Sala Razzmatazz',
          location: { latitude: '41.39701', longitude: '2.19147' },
          address: { line1: 'Carrer de Pamplona, 88' },
          city: { name: 'Barcelona' },
        },
      ],
    },
    ...overrides,
  }
}

describe('mapTicketmasterEvent', () => {
  it('maps a complete event with start, end, venue, classification, image, and price', () => {
    const result = mapTicketmasterEvent(baseEvent())

    expect(result).toEqual({
      id: encodeEventId({ provider: 'ticketmaster', externalId: 'tm-123' }),
      source: { provider: 'ticketmaster', externalId: 'tm-123' },
      name: 'Test Concert',
      category: 'music',
      start: { utc: '2026-09-18T19:00:00Z', timeZone: 'Europe/Madrid', timeKnown: true },
      end: { utc: '2026-09-18T22:00:00Z', timeZone: 'Europe/Madrid' },
      venue: {
        name: 'Sala Razzmatazz',
        coordinates: { latitude: 41.39701, longitude: 2.19147 },
        address: 'Carrer de Pamplona, 88',
        city: 'Barcelona',
      },
      url: 'https://www.ticketmaster.es/event/test-concert',
      image: { url: 'https://img/16x9.jpg', width: 1024, height: 576 },
      priceRange: { currency: 'EUR', min: 20, max: 50 },
    })
  })

  it('generates an opaque domain id via encodeEventId, not the raw external id', () => {
    const result = mapTicketmasterEvent(baseEvent())

    expect(result?.id).toBe(encodeEventId({ provider: 'ticketmaster', externalId: 'tm-123' }))
    expect(result?.id).not.toBe('tm-123')
  })

  it('leaves end undefined when dates.end is absent', () => {
    const result = mapTicketmasterEvent(
      baseEvent({ dates: { start: { dateTime: '2026-09-18T19:00:00Z' }, timezone: 'Europe/Madrid' } }),
    )

    expect(result?.end).toBeUndefined()
  })

  it('leaves priceRange undefined when priceRanges is absent', () => {
    const result = mapTicketmasterEvent(baseEvent({ priceRanges: undefined }))

    expect(result?.priceRange).toBeUndefined()
  })

  it('does not treat a missing priceRanges as a free event', () => {
    const result = mapTicketmasterEvent(baseEvent({ priceRanges: undefined }))

    expect(result?.priceRange).toBeUndefined()
    expect(result).not.toHaveProperty('priceRange.min', 0)
  })

  it('maps an "Undefined" segment to the other category', () => {
    const result = mapTicketmasterEvent(
      baseEvent({ classifications: [{ segment: { name: 'Undefined' } }] }),
    )

    expect(result?.category).toBe('other')
  })

  it('maps a missing classification to the other category', () => {
    const result = mapTicketmasterEvent(baseEvent({ classifications: undefined }))

    expect(result?.category).toBe('other')
  })

  it('converts string venue coordinates to numbers', () => {
    const result = mapTicketmasterEvent(baseEvent())

    expect(result?.venue.coordinates).toEqual({ latitude: 41.39701, longitude: 2.19147 })
    expect(typeof result?.venue.coordinates.latitude).toBe('number')
    expect(typeof result?.venue.coordinates.longitude).toBe('number')
  })

  it('rejects an event with no usable start dateTime', () => {
    const result = mapTicketmasterEvent(
      baseEvent({ dates: { start: { localDate: '2026-09-18' }, timezone: 'Europe/Madrid' } }),
    )

    expect(result).toBeNull()
  })

  it('rejects an event with no dates at all', () => {
    const result = mapTicketmasterEvent(baseEvent({ dates: undefined }))

    expect(result).toBeNull()
  })

  it('rejects an event with missing venue data', () => {
    const result = mapTicketmasterEvent(baseEvent({ _embedded: { venues: [] } }))

    expect(result).toBeNull()
  })

  it('rejects an event with invalid (non-numeric) coordinates instead of defaulting to 0', () => {
    const result = mapTicketmasterEvent(
      baseEvent({
        _embedded: {
          venues: [{ name: 'Sala Razzmatazz', location: { latitude: '', longitude: '2.19147' } }],
        },
      }),
    )

    expect(result).toBeNull()
  })

  it('rejects an event with whitespace-only coordinates instead of defaulting to 0', () => {
    const result = mapTicketmasterEvent(
      baseEvent({
        _embedded: {
          venues: [{ name: 'Sala Razzmatazz', location: { latitude: '  ', longitude: '2.19147' } }],
        },
      }),
    )

    expect(result).toBeNull()
  })

  it('keeps an event with no usable URL, leaving url undefined', () => {
    // A name, a time and a venue are enough to be a real plan — the card
    // simply does not link anywhere (see `Event.url`).
    const result = mapTicketmasterEvent(baseEvent({ url: undefined }))

    expect(result).not.toBeNull()
    expect(result?.url).toBeUndefined()
    expect(result?.name).toBe('Test Concert')
  })

  it('leaves url undefined for a malformed URL rather than passing it through', () => {
    const result = mapTicketmasterEvent(baseEvent({ url: 'not-a-url' }))

    expect(result?.url).toBeUndefined()
  })

  it('deterministically selects a landscape image over other ratios', () => {
    const result = mapTicketmasterEvent(
      baseEvent({
        images: [
          { url: 'https://img/portrait.jpg', width: 300, height: 500, ratio: '3_4' },
          { url: 'https://img/16x9-small.jpg', width: 100, height: 56, ratio: '16_9' },
          { url: 'https://img/16x9-large.jpg', width: 2048, height: 1152, ratio: '16_9' },
        ],
      }),
    )

    // prefers 16:9, then the smallest one that is still >= 640px wide
    expect(result?.image).toEqual({ url: 'https://img/16x9-large.jpg', width: 2048, height: 1152 })
  })

  it('falls back to venue timezone when dates.timezone is absent', () => {
    const result = mapTicketmasterEvent(
      baseEvent({
        dates: { start: { dateTime: '2026-09-18T19:00:00Z' } },
        _embedded: {
          venues: [
            {
              name: 'Sala Razzmatazz',
              location: { latitude: '41.39701', longitude: '2.19147' },
              timezone: 'Europe/Madrid',
            },
          ],
        },
      }),
    )

    expect(result?.start.timeZone).toBe('Europe/Madrid')
  })
})
