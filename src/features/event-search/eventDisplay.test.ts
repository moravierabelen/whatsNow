import { describe, expect, it } from 'vitest'
import type { Event } from '../../domain/events/event'
import {
  displayEventName,
  formatEventTime,
  formatOpenState,
  formatRunExtent,
  formatWeekdayTime,
} from './eventDisplay'

const MADRID = 'Europe/Madrid'

type StartAndEndDate = Pick<Event, 'start' | 'endDate'>

function event(overrides: Partial<StartAndEndDate> = {}): StartAndEndDate {
  return {
    // 2026-09-25 18:30 UTC = Fri 20:30 CEST.
    start: { utc: '2026-09-25T18:30:00.000Z', timeZone: MADRID, timeKnown: true },
    ...overrides,
  }
}

describe('formatWeekdayTime', () => {
  it('formats a known-time, single-day event as "Fri 20:30"', () => {
    expect(formatWeekdayTime(event())).toBe('Fri 20:30')
  })

  it('formats a date-only, single-day event as "Fri · Time TBA"', () => {
    const dateOnly = event({
      // Local midnight Europe/Madrid on 2026-09-25 (Friday), no endDate.
      start: { utc: '2026-09-24T22:00:00.000Z', timeZone: MADRID, timeKnown: false },
    })

    expect(formatWeekdayTime(dateOnly)).toBe('Fri · Time TBA')
  })

  it('never shows a range when the start time is known, even if endDate is the next day', () => {
    // A show starting Friday 23:00 and running past midnight into
    // Saturday — still "that day", not a range, per product rule.
    const crossesMidnight = event({
      start: { utc: '2026-09-25T21:00:00.000Z', timeZone: MADRID, timeKnown: true }, // Fri 23:00 CEST
      endDate: '2026-09-26', // Sat — must be ignored, start.timeKnown wins
    })

    expect(formatWeekdayTime(crossesMidnight)).toBe('Fri 23:00')
  })

  it('treats an endDate equal to start\'s own local date as a normal single day, not a same-day range', () => {
    const sameDayEndDate = event({
      start: { utc: '2026-09-24T22:00:00.000Z', timeZone: MADRID, timeKnown: false }, // Fri
      endDate: '2026-09-25', // same calendar day as start
    })

    expect(formatWeekdayTime(sameDayEndDate)).toBe('Fri · Time TBA')
  })
})

describe('formatEventTime', () => {
  const friday = '2026-09-25T10:00:00.000Z' // referenceTime: Friday morning
  const sunday = '2026-09-27T10:00:00.000Z' // referenceTime: Sunday morning

  it('formats a known-time event with the usual Today/Tomorrow framing (regression)', () => {
    const today = event({ start: { utc: '2026-09-25T18:30:00.000Z', timeZone: MADRID, timeKnown: true } })
    expect(formatEventTime(today, friday)).toBe('Today, 20:30')

    const tomorrow = event({ start: { utc: '2026-09-26T18:30:00.000Z', timeZone: MADRID, timeKnown: true } })
    expect(formatEventTime(tomorrow, friday)).toBe('Tomorrow, 20:30')
  })

  it('formats a date-only, single-day event with "Time TBA" (regression)', () => {
    const dateOnly = event({ start: { utc: '2026-09-24T22:00:00.000Z', timeZone: MADRID, timeKnown: false } })

    expect(formatEventTime(dateOnly, friday)).toBe('Today, Time TBA')
  })

  it('never shows a range for a known-time event that crosses midnight, even far from referenceTime', () => {
    const crossesMidnight = event({
      start: { utc: '2026-09-25T21:00:00.000Z', timeZone: MADRID, timeKnown: true }, // Fri 23:00 CEST
      endDate: '2026-09-26',
    })

    expect(formatEventTime(crossesMidnight, sunday)).toBe('Fri, Sep 25 · 23:00')
  })
})

describe('formatRunExtent', () => {
  it('shows an absolute weekday range for a short run, with no "Time TBA"', () => {
    const festival = event({
      start: { utc: '2026-09-24T22:00:00.000Z', timeZone: MADRID, timeKnown: false }, // Fri
      endDate: '2026-09-26', // Sat
    })

    expect(formatRunExtent(festival)).toBe('Fri–Sat')
  })

  it('shows the same range whichever day of the run it is read on, since it names no "today"', () => {
    const festival = event({
      start: { utc: '2026-09-20T22:00:00.000Z', timeZone: MADRID, timeKnown: false }, // Mon
      endDate: '2026-09-23', // Wed
    })

    expect(formatRunExtent(festival)).toBe('Mon–Wed')
  })

  it('keeps the range at six days, the longest span whose weekday names stay distinct', () => {
    const run = event({
      start: { utc: '2026-09-20T22:00:00.000Z', timeZone: MADRID, timeKnown: false }, // Mon
      endDate: '2026-09-27', // the following Sunday
    })

    expect(formatRunExtent(run)).toBe('Mon–Sun')
  })

  it('switches to an end date once weekday names would repeat', () => {
    const run = event({
      start: { utc: '2026-09-20T22:00:00.000Z', timeZone: MADRID, timeKnown: false }, // Mon
      endDate: '2026-09-28', // the following Monday — "Mon–Mon" would say nothing
    })

    expect(formatRunExtent(run)).toBe('Until Sep 28')
  })

  it('gives an end date for a months-long run, where a weekday range was meaningless', () => {
    // The reported bug: an 11-month exhibition rendered as "Thu–Thu".
    const exhibition = event({
      start: { utc: '2026-01-20T23:00:00.000Z', timeZone: MADRID, timeKnown: false },
      endDate: '2026-12-31',
    })

    expect(formatRunExtent(exhibition)).toBe('Until Dec 31')
  })

  it('has no extent for a single day', () => {
    const singleDay = event({ start: { utc: '2026-09-24T22:00:00.000Z', timeZone: MADRID, timeKnown: false } })

    expect(formatRunExtent(singleDay)).toBeUndefined()
  })

  it('has no extent when endDate is the start\'s own local date', () => {
    const sameDay = event({
      start: { utc: '2026-09-24T22:00:00.000Z', timeZone: MADRID, timeKnown: false }, // Fri
      endDate: '2026-09-25',
    })

    expect(formatRunExtent(sameDay)).toBeUndefined()
  })

  it('has no extent when the start time is known, which decides the day on its own', () => {
    const crossesMidnight = event({
      start: { utc: '2026-09-25T21:00:00.000Z', timeZone: MADRID, timeKnown: true }, // Fri 23:00
      endDate: '2026-09-26',
    })

    expect(formatRunExtent(crossesMidnight)).toBeUndefined()
  })
})

describe('formatOpenState', () => {
  const TUE = 2
  const at = (hours: number) => hours * 60
  // 12:00 local on Tuesday 2026-09-15.
  const tuesdayNoon = '2026-09-15T10:00:00.000Z'

  function openRun(overrides: Partial<Pick<Event, 'endDate' | 'openingHours'>> = {}) {
    return {
      start: { utc: '2026-04-17T22:00:00.000Z', timeZone: MADRID, timeKnown: false },
      endDate: '2026-12-20',
      ...overrides,
    }
  }

  it('says how long it stays open when it is open now', () => {
    const event = openRun({ openingHours: { [TUE]: [{ start: at(11), end: at(20) }] } })

    expect(formatOpenState(event, tuesdayNoon)).toBe('Open now · until 20:00')
  })

  it('says when it opens when that is still ahead', () => {
    const event = openRun({ openingHours: { [TUE]: [{ start: at(16), end: at(20) }] } })

    expect(formatOpenState(event, tuesdayNoon)).toBe('Opens 16:00')
  })

  it('picks the next shift of a split day, not the one already finished', () => {
    const event = openRun({
      openingHours: { [TUE]: [{ start: at(9), end: at(11) }, { start: at(16), end: at(20) }] },
    })

    expect(formatOpenState(event, tuesdayNoon)).toBe('Opens 16:00')
  })

  it('falls back to the run extent once the day is over, claiming nothing about now', () => {
    const event = openRun({ openingHours: { [TUE]: [{ start: at(9), end: at(11) }] } })

    expect(formatOpenState(event, tuesdayNoon)).toBe('Until Dec 20')
  })

  it('falls back to the run extent when the source states no hours', () => {
    expect(formatOpenState(openRun(), tuesdayNoon)).toBe('Until Dec 20')
  })

  it('admits it plainly when there is neither an extent nor any hours', () => {
    const event = { start: { utc: '2026-09-14T22:00:00.000Z', timeZone: MADRID, timeKnown: false } }

    expect(formatOpenState(event, tuesdayNoon)).toBe('Hours not listed')
  })
})

describe('displayEventName', () => {
  function eventWithVenue(name: string, venueName: string): Pick<Event, 'name' | 'venue'> {
    return { name, venue: { name: venueName, coordinates: { latitude: 41.38, longitude: 2.17 } } }
  }

  it('strips a trailing "at <venue>" suffix that names this event\'s own venue', () => {
    expect(displayEventName(eventWithVenue('Fritz Kalkbrenner at SEASEACLUB', 'SEASEACLUB'))).toBe('Fritz Kalkbrenner')
  })

  it('strips the suffix case-insensitively', () => {
    expect(displayEventName(eventWithVenue('Fritz Kalkbrenner AT seaseaclub', 'SEASEACLUB'))).toBe('Fritz Kalkbrenner')
  })

  it('leaves the name untouched when it does not end with "at <this venue>"', () => {
    // Ticketmaster-style: no provider-appended venue suffix at all.
    expect(displayEventName(eventWithVenue('Fritz Kalkbrenner', 'SEASEACLUB'))).toBe('Fritz Kalkbrenner')
  })

  it('leaves the name untouched when the trailing venue mention does not match this event\'s own venue', () => {
    // Guards against over-eager stripping when the suffix names a different place.
    expect(displayEventName(eventWithVenue('Fritz Kalkbrenner at Razzmatazz 2', 'SEASEACLUB'))).toBe(
      'Fritz Kalkbrenner at Razzmatazz 2',
    )
  })

  it('never mangles a real artist/event name that happens to contain " at " mid-string', () => {
    expect(displayEventName(eventWithVenue('Meet Me At The Altar', 'SEASEACLUB'))).toBe('Meet Me At The Altar')
  })

  it('does not strip down to an empty name', () => {
    // The whole name IS the venue mention — stripping it would leave nothing useful.
    expect(displayEventName(eventWithVenue('at SEASEACLUB', 'SEASEACLUB'))).toBe('at SEASEACLUB')
  })
})
