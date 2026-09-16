import { describe, expect, it } from 'vitest'
import type { Event } from './event'
import {
  STARTING_SOON_WINDOW_MINUTES,
  classifyNowBucket,
  eventOverlapsWindow,
  resolveTimeWindow,
} from './temporal'

const MADRID = 'Europe/Madrid'

function interval(startUtc: string, endUtc?: string): Pick<Event, 'start' | 'end'> {
  return {
    start: { utc: startUtc, timeZone: MADRID },
    end: endUtc === undefined ? undefined : { utc: endUtc, timeZone: MADRID },
  }
}

describe('resolveTimeWindow', () => {
  it('resolves Today as local midnight to local midnight next day', () => {
    const window = resolveTimeWindow('today', '2026-09-15T10:00:00Z', MADRID)
    expect(window).toEqual({ start: '2026-09-14T22:00:00.000Z', end: '2026-09-15T22:00:00.000Z' })
  })

  it('resolves Tomorrow as the following local day', () => {
    const window = resolveTimeWindow('tomorrow', '2026-09-15T10:00:00Z', MADRID)
    expect(window).toEqual({ start: '2026-09-15T22:00:00.000Z', end: '2026-09-16T22:00:00.000Z' })
  })

  it('resolves Weekend across a DST fall-back day with the correct real-world instants', () => {
    // Madrid switches from CEST (+2) to CET (+1) at 2026-10-25 03:00 local.
    const window = resolveTimeWindow('today', '2026-10-25T10:00:00Z', MADRID)
    expect(window).toEqual({ start: '2026-10-24T22:00:00.000Z', end: '2026-10-25T23:00:00.000Z' })
    const durationHours = (new Date(window.end).getTime() - new Date(window.start).getTime()) / 3_600_000
    expect(durationHours).toBe(25)
  })

  it('resolves Today across a DST spring-forward day with the correct real-world instants', () => {
    // Madrid switches from CET (+1) to CEST (+2) at 2027-03-28 02:00 local.
    const window = resolveTimeWindow('today', '2027-03-28T10:00:00Z', MADRID)
    expect(window).toEqual({ start: '2027-03-27T23:00:00.000Z', end: '2027-03-28T22:00:00.000Z' })
    const durationHours = (new Date(window.end).getTime() - new Date(window.start).getTime()) / 3_600_000
    expect(durationHours).toBe(23)
  })
})

describe('eventOverlapsWindow — Today', () => {
  const today = resolveTimeWindow('today', '2026-09-15T10:00:00Z', MADRID)

  it('includes an event entirely within the day', () => {
    expect(eventOverlapsWindow(interval('2026-09-15T10:00:00Z', '2026-09-15T12:00:00Z'), today)).toBe(true)
  })

  it('includes an event that started yesterday and ends today', () => {
    expect(eventOverlapsWindow(interval('2026-09-14T10:00:00Z', '2026-09-15T05:00:00Z'), today)).toBe(true)
  })

  it('includes an event that started yesterday and ends tomorrow', () => {
    expect(eventOverlapsWindow(interval('2026-09-14T10:00:00Z', '2026-09-16T10:00:00Z'), today)).toBe(true)
  })

  it('excludes an event that ended before today', () => {
    expect(eventOverlapsWindow(interval('2026-09-13T10:00:00Z', '2026-09-14T10:00:00Z'), today)).toBe(false)
  })

  it('includes an event that started yesterday with an unknown end, rather than excluding it', () => {
    expect(eventOverlapsWindow(interval('2026-09-14T10:00:00Z'), today)).toBe(true)
  })
})

describe('eventOverlapsWindow — Tomorrow', () => {
  it('includes a multi-day event that spans into tomorrow', () => {
    const tomorrow = resolveTimeWindow('tomorrow', '2026-09-15T10:00:00Z', MADRID)
    expect(eventOverlapsWindow(interval('2026-09-15T10:00:00Z', '2026-09-17T10:00:00Z'), tomorrow)).toBe(true)
  })
})

describe('eventOverlapsWindow — Weekend', () => {
  const referenceTime = '2026-09-15T10:00:00Z' // Tuesday
  const weekend = resolveTimeWindow('weekend', referenceTime, MADRID)

  it('includes an event that starts before Friday and continues into the weekend', () => {
    expect(eventOverlapsWindow(interval('2026-09-17T10:00:00Z', '2026-09-19T10:00:00Z'), weekend)).toBe(true)
  })

  it('includes an event starting exactly at Friday 18:00', () => {
    const twoHoursLater = new Date(new Date(weekend.start).getTime() + 2 * 3_600_000).toISOString()
    expect(eventOverlapsWindow(interval(weekend.start, twoHoursLater), weekend)).toBe(true)
  })

  it('excludes an event that ends exactly at Friday 18:00', () => {
    const threeHoursBefore = new Date(new Date(weekend.start).getTime() - 3 * 3_600_000).toISOString()
    expect(eventOverlapsWindow(interval(threeHoursBefore, weekend.start), weekend)).toBe(false)
  })

  it('excludes an event that starts exactly at Monday 00:00', () => {
    const twoHoursLater = new Date(new Date(weekend.end).getTime() + 2 * 3_600_000).toISOString()
    expect(eventOverlapsWindow(interval(weekend.end, twoHoursLater), weekend)).toBe(false)
  })
})

describe('classifyNowBucket', () => {
  const referenceTime = '2026-09-15T12:00:00Z'

  it('classifies an event with start before and end after referenceTime as happening-now', () => {
    expect(classifyNowBucket(interval('2026-09-15T10:00:00Z', '2026-09-15T14:00:00Z'), referenceTime, MADRID)).toBe(
      'happening-now',
    )
  })

  it('classifies an event starting exactly at referenceTime (with a future end) as happening-now', () => {
    expect(classifyNowBucket(interval(referenceTime, '2026-09-15T14:00:00Z'), referenceTime, MADRID)).toBe(
      'happening-now',
    )
  })

  it('does not classify an event as happening-now once referenceTime reaches its end', () => {
    expect(classifyNowBucket(interval('2026-09-15T10:00:00Z', referenceTime), referenceTime, MADRID)).toBeNull()
  })

  it('returns null for an event that already started with no known end', () => {
    expect(classifyNowBucket(interval('2026-09-15T09:00:00Z'), referenceTime, MADRID)).toBeNull()
  })

  it('classifies an event starting within the next 180 minutes as starting-soon', () => {
    expect(classifyNowBucket(interval('2026-09-15T13:00:00Z'), referenceTime, MADRID)).toBe('starting-soon')
  })

  it('classifies an event starting exactly at +180 minutes as starting-soon', () => {
    const start = new Date(new Date(referenceTime).getTime() + STARTING_SOON_WINDOW_MINUTES * 60_000).toISOString()
    expect(classifyNowBucket(interval(start), referenceTime, MADRID)).toBe('starting-soon')
  })

  it('classifies an event starting after +180 minutes as later-today', () => {
    const start = new Date(
      new Date(referenceTime).getTime() + STARTING_SOON_WINDOW_MINUTES * 60_000 + 60_000,
    ).toISOString()
    expect(classifyNowBucket(interval(start), referenceTime, MADRID)).toBe('later-today')
  })

  it('returns null for an event starting exactly at referenceTime with no known end', () => {
    expect(classifyNowBucket(interval(referenceTime), referenceTime, MADRID)).toBeNull()
  })

  it('does not classify an event outside Today as Now, even if its start looks numerically close', () => {
    // referenceTime is 23:00 local on Sept 15; the event starts 30 minutes later but
    // already falls on Sept 16 local, i.e. outside Today's window.
    const lateReferenceTime = '2026-09-15T21:00:00Z'
    const justAfterMidnightLocal = '2026-09-15T22:30:00Z'
    expect(classifyNowBucket(interval(justAfterMidnightLocal), lateReferenceTime, MADRID)).toBeNull()
  })
})
