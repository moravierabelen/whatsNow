import { describe, expect, it } from 'vitest'
import type { Event } from '../domain/events/event'
import { deduplicateEvents, namesLikelyMatch } from './deduplicateEvents'

const RAZZMATAZZ_3: Event['venue'] = {
  name: 'Sala Razzmatazz 3',
  coordinates: { latitude: 41.39701, longitude: 2.19147 },
}
// The same real venue, JamBase's slightly different coordinates (~50m off)
// and shorter name — the exact real-world case this heuristic was built for.
const RAZZMATAZZ_3_JAMBASE: Event['venue'] = {
  name: 'Razzmatazz 3',
  coordinates: { latitude: 41.3977, longitude: 2.1911 },
}
const FAR_AWAY_VENUE: Event['venue'] = {
  name: 'Some Other Club',
  coordinates: { latitude: 41.4, longitude: 2.3 }, // several km away
}

function event(overrides: Partial<Event> = {}): Event {
  return {
    id: 'evt',
    source: { provider: 'ticketmaster', externalId: 'ext' },
    name: 'Event',
    category: 'music',
    start: { utc: '2026-09-25T18:30:00.000Z', timeZone: 'Europe/Madrid', timeKnown: true },
    venue: RAZZMATAZZ_3,
    url: 'https://example.com',
    ...overrides,
  }
}

describe('namesLikelyMatch', () => {
  it('matches the real "Only The Poets" case across providers, ignoring venue-name echo', () => {
    expect(
      namesLikelyMatch(
        'only the poets - AND I’D DO IT AGAIN',
        'Sala Razzmatazz 3',
        'Only The Poets at Razzmatazz 3',
        'Razzmatazz 3',
      ),
    ).toBe(true)
  })

  it('does not match two different acts that both mention the same venue', () => {
    // Exactly the false-positive this heuristic is designed to avoid: two
    // different shows, same complex, same "at Razzmatazz 3" phrasing.
    expect(namesLikelyMatch('DJ Foo at Razzmatazz 3', 'Razzmatazz 3', 'DJ Bar at Razzmatazz 3', 'Razzmatazz 3')).toBe(
      false,
    )
  })

  it('matches on a single shared token when that is the only signal on either side', () => {
    expect(namesLikelyMatch('Metallica', 'Palau Sant Jordi', 'Metallica Live', 'Palau Sant Jordi')).toBe(true)
  })

  it('does not match names with no meaningful overlap', () => {
    expect(namesLikelyMatch('Totally Unrelated Thing', 'Venue A', 'Something Else Entirely', 'Venue B')).toBe(false)
  })
})

describe('deduplicateEvents', () => {
  it('merges a real cross-provider duplicate: same start + nearby venue + related names', () => {
    const ticketmasterEvent = event({
      id: 'tm-1',
      source: { provider: 'ticketmaster', externalId: 'tm-1' },
      name: 'only the poets - AND I’D DO IT AGAIN',
      venue: RAZZMATAZZ_3,
    })
    const jamBaseEvent = event({
      id: 'jb-1',
      source: { provider: 'jambase', externalId: 'jb-1' },
      name: 'Only The Poets at Razzmatazz 3',
      venue: RAZZMATAZZ_3_JAMBASE,
    })

    const result = deduplicateEvents([ticketmasterEvent, jamBaseEvent])

    expect(result).toHaveLength(1)
  })

  it('keeps both events when names are clearly different, even at the same time and venue', () => {
    const djFoo = event({ id: 'foo', name: 'DJ Foo at Razzmatazz 3', venue: RAZZMATAZZ_3 })
    const djBar = event({ id: 'bar', name: 'DJ Bar at Razzmatazz 3', venue: RAZZMATAZZ_3_JAMBASE })

    const result = deduplicateEvents([djFoo, djBar])

    expect(result.map((e) => e.id)).toEqual(['foo', 'bar'])
  })

  it('keeps both events when the times differ, even with matching names/venue', () => {
    const first = event({
      id: 'first',
      name: 'Only The Poets at Razzmatazz 3',
      start: { utc: '2026-09-25T18:30:00.000Z', timeZone: 'Europe/Madrid', timeKnown: true },
    })
    const second = event({
      id: 'second',
      name: 'Only The Poets at Razzmatazz 3',
      start: { utc: '2026-09-26T18:30:00.000Z', timeZone: 'Europe/Madrid', timeKnown: true },
    })

    const result = deduplicateEvents([first, second])

    expect(result.map((e) => e.id)).toEqual(['first', 'second'])
  })

  it('does not deduplicate matching names when the venues are far apart', () => {
    const first = event({ id: 'first', name: 'Only The Poets at Razzmatazz 3', venue: RAZZMATAZZ_3 })
    const second = event({ id: 'second', name: 'Only The Poets Tour', venue: FAR_AWAY_VENUE })

    const result = deduplicateEvents([first, second])

    expect(result.map((e) => e.id)).toEqual(['first', 'second'])
  })

  it('never deduplicates events with an unknown start time — there is no reliable instant to compare', () => {
    const first = event({
      id: 'first',
      name: 'Only The Poets at Razzmatazz 3',
      start: { utc: '2026-09-25T00:00:00.000Z', timeZone: 'Europe/Madrid', timeKnown: false },
    })
    const second = event({
      id: 'second',
      name: 'Only The Poets at Razzmatazz 3',
      start: { utc: '2026-09-25T00:00:00.000Z', timeZone: 'Europe/Madrid', timeKnown: false },
    })

    const result = deduplicateEvents([first, second])

    expect(result.map((e) => e.id)).toEqual(['first', 'second'])
  })

  it('keeps the richer record when two events are deduplicated — image counts most', () => {
    const plain = event({ id: 'plain', name: 'Only The Poets at Razzmatazz 3' })
    const withImage = event({
      id: 'with-image',
      name: 'Only The Poets at Razzmatazz 3',
      venue: RAZZMATAZZ_3_JAMBASE,
      image: { url: 'https://example.com/poster.jpg' },
    })

    const result = deduplicateEvents([plain, withImage])

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('with-image')
  })

  it('keeps the first-seen event as a stable tiebreak when richness scores are equal', () => {
    const first = event({ id: 'first', name: 'Only The Poets at Razzmatazz 3' })
    const second = event({ id: 'second', name: 'Only The Poets at Razzmatazz 3', venue: RAZZMATAZZ_3_JAMBASE })

    const result = deduplicateEvents([first, second])

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('first')
  })

  it('leaves a fully unrelated set of events untouched', () => {
    const events = [
      event({ id: 'a', name: 'Alpha Show' }),
      event({ id: 'b', name: 'Beta Gig', venue: FAR_AWAY_VENUE }),
      event({ id: 'c', name: 'Gamma Night', start: { utc: '2026-09-26T20:00:00.000Z', timeZone: 'Europe/Madrid', timeKnown: true } }),
    ]

    const result = deduplicateEvents(events)

    expect(result.map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })
})
