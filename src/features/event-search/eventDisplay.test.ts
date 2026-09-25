import { describe, expect, it } from 'vitest'
import type { Event } from '../../domain/events/event'
import { displayEventName, formatEventTime, formatWeekdayTime } from './eventDisplay'

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

  it('formats a date-only, multi-day event as an absolute weekday range, with no "Time TBA"', () => {
    const festival = event({
      start: { utc: '2026-09-24T22:00:00.000Z', timeZone: MADRID, timeKnown: false }, // Fri
      endDate: '2026-09-26', // Sat
    })

    expect(formatWeekdayTime(festival)).toBe('Fri–Sat')
  })

  it('formats a 3-day date-only event as "Mon–Wed"', () => {
    const festival = event({
      // Local midnight Europe/Madrid on 2026-09-21 (Monday).
      start: { utc: '2026-09-20T22:00:00.000Z', timeZone: MADRID, timeKnown: false },
      endDate: '2026-09-23', // Wed
    })

    expect(formatWeekdayTime(festival)).toBe('Mon–Wed')
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
  const saturday = '2026-09-26T10:00:00.000Z' // referenceTime: Saturday morning
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

  it('shows the same absolute range no matter which day of the event it is viewed from', () => {
    // Multi-day festival: Fri 2026-09-25 -> Sat 2026-09-26.
    const festival = event({
      start: { utc: '2026-09-24T22:00:00.000Z', timeZone: MADRID, timeKnown: false },
      endDate: '2026-09-26',
    })

    expect(formatEventTime(festival, friday)).toBe('Fri–Sat') // viewed on day 1
    expect(formatEventTime(festival, saturday)).toBe('Fri–Sat') // viewed on day 2 / last day
  })

  it('keeps showing the full range on the last day of a longer multi-day event', () => {
    // Mon 2026-09-21 -> Wed 2026-09-23.
    const festival = event({
      start: { utc: '2026-09-20T22:00:00.000Z', timeZone: MADRID, timeKnown: false },
      endDate: '2026-09-23',
    })
    const monday = '2026-09-21T10:00:00.000Z'
    const tuesday = '2026-09-22T10:00:00.000Z'
    const wednesday = '2026-09-23T10:00:00.000Z'

    expect(formatEventTime(festival, monday)).toBe('Mon–Wed') // viewed on day 1
    expect(formatEventTime(festival, tuesday)).toBe('Mon–Wed') // viewed on day 2 (middle)
    expect(formatEventTime(festival, wednesday)).toBe('Mon–Wed') // viewed on the last day
  })

  it('never shows a range for a known-time event that crosses midnight, even far from referenceTime', () => {
    const crossesMidnight = event({
      start: { utc: '2026-09-25T21:00:00.000Z', timeZone: MADRID, timeKnown: true }, // Fri 23:00 CEST
      endDate: '2026-09-26',
    })

    expect(formatEventTime(crossesMidnight, sunday)).toBe('Fri, Sep 25 · 23:00')
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
