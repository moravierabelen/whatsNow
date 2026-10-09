import { describe, expect, it } from 'vitest'
import type { Event } from '../../domain/events/event'
import { selectFeaturedEvent, sortByStart, splitByTiming } from './eventSelection'

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

describe('splitByTiming', () => {
  // 12:00 local on Tuesday 2026-09-15 (Europe/Madrid, UTC+2 in September).
  const referenceTime = '2026-09-15T10:00:00.000Z'
  const TUE = 2
  const at = (hours: number) => hours * 60

  /** A drop-in run: no clock time of its own, bounded by `endDate`. */
  function run(id: string, overrides: Partial<Event> = {}): Event {
    return event({
      id,
      start: { utc: '2026-04-17T22:00:00.000Z', timeZone: 'Europe/Madrid', timeKnown: false },
      endDate: '2026-12-20',
      ...overrides,
    })
  }

  it('separates plans with a clock time from drop-in runs', () => {
    const timed = event({ id: 'timed' })
    const open = run('open')

    const sections = splitByTiming([open, timed], referenceTime)

    expect(sections.timed.map((e) => e.id)).toEqual(['timed'])
    expect(sections.open.map((e) => e.id)).toEqual(['open'])
  })

  it('orders timed plans chronologically', () => {
    // The reported bug: a 23:45 concert buried under runs that began months ago.
    const late = event({ id: 'late', start: { utc: '2026-09-15T21:45:00.000Z', timeZone: 'Europe/Madrid', timeKnown: true } })
    const early = event({ id: 'early', start: { utc: '2026-09-15T16:00:00.000Z', timeZone: 'Europe/Madrid', timeKnown: true } })

    expect(splitByTiming([late, early], referenceTime).timed.map((e) => e.id)).toEqual(['early', 'late'])
  })

  it('puts what is open now first, then what opens later, then what we cannot place', () => {
    const openUntilEight = run('open-until-20', { openingHours: { [TUE]: [{ start: at(11), end: at(20) }] } })
    const openUntilTwo = run('open-until-14', { openingHours: { [TUE]: [{ start: at(11), end: at(14) }] } })
    const opensLater = run('opens-16', { openingHours: { [TUE]: [{ start: at(16), end: at(20) }] } })
    const closedToday = run('closed', { openingHours: { [TUE]: 'closed' } })
    const noHours = run('no-hours')

    const sections = splitByTiming([noHours, opensLater, openUntilEight, closedToday, openUntilTwo], referenceTime)

    // Within "open", the one closing soonest is the most urgent.
    expect(sections.open.map((e) => e.id)).toEqual([
      'open-until-14',
      'open-until-20',
      'opens-16',
      'closed',
      'no-hours',
    ])
  })

  it('orders runs with no stated hours by the one ending soonest', () => {
    const ends = (id: string, endDate: string) => run(id, { endDate })

    const sections = splitByTiming([ends('december', '2026-12-20'), ends('october', '2026-10-05')], referenceTime)

    expect(sections.open.map((e) => e.id)).toEqual(['october', 'december'])
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
