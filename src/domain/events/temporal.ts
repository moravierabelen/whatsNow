import { TZDate } from '@date-fns/tz'
import { addDays, startOfDay } from 'date-fns'
import type { Event } from './event'
import type { TimeMode } from './provider'

export const STARTING_SOON_WINDOW_MINUTES = 180
export const TONIGHT_START_HOUR = 18
export const TONIGHT_END_HOUR = 6

export interface TimeWindow {
  start: string
  end: string
}

export type NowBucket = 'happening-now' | 'starting-soon' | 'later-today'

function toIsoInstant(date: Date): string {
  return new Date(date.getTime()).toISOString()
}

function startOfLocalDay(referenceTime: string, timeZone: string): Date {
  return startOfDay(new TZDate(referenceTime, timeZone))
}

function resolveWeekendWindow(referenceTime: string, timeZone: string): { start: Date; end: Date } {
  const reference = new TZDate(referenceTime, timeZone)
  const daysSinceFriday = (reference.getDay() - 5 + 7) % 7
  const fridayMidnight = addDays(startOfDay(reference), -daysSinceFriday)
  const fridayEvening = new TZDate(fridayMidnight.getTime(), timeZone)
  fridayEvening.setHours(18, 0, 0, 0)
  const mondayMidnight = addDays(fridayMidnight, 3)

  if (reference.getTime() < mondayMidnight.getTime()) {
    return { start: fridayEvening, end: mondayMidnight }
  }
  return { start: addDays(fridayEvening, 7), end: addDays(mondayMidnight, 7) }
}

/**
 * The current-or-next night block, e.g. queried at Saturday 15:00 or at
 * Sunday 01:00 both resolve to Saturday 18:00 -> Sunday 06:00; queried at
 * Sunday 10:00 it rolls forward to Sunday 18:00 -> Monday 06:00. Mirrors
 * `resolveWeekendWindow`'s current-or-next pattern.
 */
function resolveTonightWindow(referenceTime: string, timeZone: string): { start: Date; end: Date } {
  const reference = new TZDate(referenceTime, timeZone)
  const today = startOfDay(reference)
  const yesterday = addDays(today, -1)

  const candidateStart = new TZDate(yesterday.getTime(), timeZone)
  candidateStart.setHours(TONIGHT_START_HOUR, 0, 0, 0)
  const candidateEnd = new TZDate(today.getTime(), timeZone)
  candidateEnd.setHours(TONIGHT_END_HOUR, 0, 0, 0)

  if (reference.getTime() < candidateEnd.getTime()) {
    return { start: candidateStart, end: candidateEnd }
  }
  return { start: addDays(candidateStart, 1), end: addDays(candidateEnd, 1) }
}

export function resolveTimeWindow(mode: TimeMode, referenceTime: string, timeZone: string): TimeWindow {
  if (mode === 'weekend') {
    const { start, end } = resolveWeekendWindow(referenceTime, timeZone)
    return { start: toIsoInstant(start), end: toIsoInstant(end) }
  }

  if (mode === 'tonight') {
    const { start, end } = resolveTonightWindow(referenceTime, timeZone)
    return { start: toIsoInstant(start), end: toIsoInstant(end) }
  }

  const today = startOfLocalDay(referenceTime, timeZone)
  const offsetDays = mode === 'tomorrow' ? 1 : 0
  return {
    start: toIsoInstant(addDays(today, offsetDays)),
    end: toIsoInstant(addDays(today, offsetDays + 1)),
  }
}

export function eventOverlapsWindow(event: Pick<Event, 'start' | 'end'>, window: TimeWindow): boolean {
  const eventStart = new Date(event.start.utc).getTime()
  const windowStart = new Date(window.start).getTime()
  const windowEnd = new Date(window.end).getTime()

  if (eventStart >= windowEnd) return false
  if (event.end === undefined) return true
  return new Date(event.end.utc).getTime() > windowStart
}

export function classifyNowBucket(
  event: Pick<Event, 'start' | 'end'>,
  referenceTime: string,
  timeZone: string,
): NowBucket | null {
  const todayWindow = resolveTimeWindow('today', referenceTime, timeZone)
  if (!eventOverlapsWindow(event, todayWindow)) return null

  const reference = new Date(referenceTime).getTime()
  const start = new Date(event.start.utc).getTime()

  if (event.end !== undefined) {
    const end = new Date(event.end.utc).getTime()
    if (start <= reference && reference < end) return 'happening-now'
  }

  if (start > reference) {
    const startingSoonCutoff = reference + STARTING_SOON_WINDOW_MINUTES * 60_000
    return start <= startingSoonCutoff ? 'starting-soon' : 'later-today'
  }

  return null
}
