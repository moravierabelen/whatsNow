import { describe, expect, it } from 'vitest'
import type { Event } from '../../domain/events/event'
import { groupByNowBucket, selectFeaturedEvent, sortByStart } from './eventSelection'

function event(overrides: Partial<Event> = {}): Event {
  return {
    id: 'evt',
    source: { provider: 'ticketmaster', externalId: 'ext' },
    name: 'Event',
    category: 'music',
    start: { utc: '2026-09-19T20:00:00.000Z', timeZone: 'Europe/Madrid', timeKnown: true },
    venue: { name: 'Venue', coordinates: { latitude: 41.38, longitude: 2.17 } },
    url: 'https://example.com',
    ...overrides,
  }
}

describe('sortByStart', () => {
  it('orders events chronologically regardless of input order', () => {
    // Reproduces the reported bug: providers are concatenated (Ticketmaster
    // block, then JamBase block), each internally sorted but the combined
    // list isn't — a 23:45 event ending up after several 23:59 ones.
    const late = event({
      id: 'late',
      start: { utc: '2026-09-19T23:45:00.000Z', timeZone: 'Europe/Madrid', timeKnown: true },
    })
    const early = event({
      id: 'early',
      start: { utc: '2026-09-19T18:00:00.000Z', timeZone: 'Europe/Madrid', timeKnown: true },
    })
    const middle = event({
      id: 'middle',
      start: { utc: '2026-09-19T21:00:00.000Z', timeZone: 'Europe/Madrid', timeKnown: true },
    })

    const result = sortByStart([late, early, middle])

    expect(result.map((e) => e.id)).toEqual(['early', 'middle', 'late'])
  })
})

describe('groupByNowBucket', () => {
  it('returns each bucket chronologically sorted', () => {
    // Reference at 12:00 local (Europe/Madrid, UTC+2 in September) — both
    // events land well after the 180min "starting soon" cutoff, and well
    // before local midnight, so both are unambiguously "later today".
    const referenceTime = '2026-09-19T10:00:00.000Z'
    const laterA = event({
      id: 'later-a',
      start: { utc: '2026-09-19T21:00:00.000Z', timeZone: 'Europe/Madrid', timeKnown: true }, // 23:00 local
    })
    const laterB = event({
      id: 'later-b',
      start: { utc: '2026-09-19T18:00:00.000Z', timeZone: 'Europe/Madrid', timeKnown: true }, // 20:00 local
    })

    const buckets = groupByNowBucket([laterA, laterB], referenceTime)

    expect(buckets.laterToday.map((e) => e.id)).toEqual(['later-b', 'later-a'])
  })
})

describe('selectFeaturedEvent', () => {
  const referenceTime = '2026-09-19T10:00:00.000Z'

  it('never picks an event with an unknown start time, even if it would otherwise rank first', () => {
    const dateOnly = event({
      id: 'date-only',
      image: { url: 'https://example.com/img.jpg' },
      start: { utc: '2026-09-19T22:00:00.000Z', timeZone: 'Europe/Madrid', timeKnown: false },
    })
    const timed = event({ id: 'timed', start: { utc: '2026-09-19T21:00:00.000Z', timeZone: 'Europe/Madrid', timeKnown: true } })

    const result = selectFeaturedEvent([dateOnly, timed], referenceTime)

    expect(result?.id).toBe('timed')
  })

  it('returns undefined when every candidate has an unknown start time', () => {
    const dateOnly = event({ start: { utc: '2026-09-19T22:00:00.000Z', timeZone: 'Europe/Madrid', timeKnown: false } })

    expect(selectFeaturedEvent([dateOnly], referenceTime)).toBeUndefined()
  })
})
