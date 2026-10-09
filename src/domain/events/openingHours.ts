import { TZDate } from '@date-fns/tz'
import { startOfDay } from 'date-fns'

/** Minutes from local midnight, in the event's own timezone. */
export interface OpeningInterval {
  start: number
  /** Absent for a showtime: a moment to arrive at, not a span to drop into. */
  end?: number
}

/** 0 is Sunday, matching `Date#getDay`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** A weekday with no entry is unknown, which is not the same as `'closed'`. */
export type OpeningHours = Partial<Record<Weekday, OpeningInterval[] | 'closed'>>

export interface OpeningInstants {
  open: number
  /** Absent for a showtime, which occupies no span. */
  close?: number
}

function instantAt(day: TZDate, minutes: number, timeZone: string): number {
  const at = new TZDate(day.getTime(), timeZone)
  at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return at.getTime()
}

/**
 * The given local day's intervals as absolute instants. Empty when the source
 * says the event is closed that weekday, and equally when it says nothing.
 */
export function openingInstantsOn(hours: OpeningHours, day: TZDate, timeZone: string): OpeningInstants[] {
  const intervals = hours[day.getDay() as Weekday]
  if (intervals === undefined || intervals === 'closed') return []

  return intervals.map((interval) => ({
    open: instantAt(day, interval.start, timeZone),
    ...(interval.end !== undefined && { close: instantAt(day, interval.end, timeZone) }),
  }))
}

export type OpenState =
  | { state: 'open'; closesAt: number }
  | { state: 'opens-later'; opensAt: number }
  /** Hours are stated, but none are left on the reference day. */
  | { state: 'closed' }
  /** The source never said, so we claim nothing. */
  | { state: 'unknown' }

/** Most actionable first, so a listing can sort straight off the state. */
export const OPEN_STATE_RANK: Record<OpenState['state'], number> = {
  open: 0,
  'opens-later': 1,
  closed: 2,
  unknown: 3,
}

/** Where a drop-in plan stands on the local day containing `referenceTime`. */
export function resolveOpenState(
  hours: OpeningHours | undefined,
  referenceTime: string,
  timeZone: string,
): OpenState {
  if (!hours) return { state: 'unknown' }

  const now = new Date(referenceTime).getTime()
  const spans = openingInstantsOn(hours, startOfDay(new TZDate(referenceTime, timeZone)), timeZone)
  if (spans.length === 0) return { state: 'closed' }

  for (const { open, close } of spans) {
    if (close !== undefined && open <= now && now < close) return { state: 'open', closesAt: close }
  }

  const upcoming = spans.filter((span) => span.open > now).sort((a, b) => a.open - b.open)[0]
  return upcoming ? { state: 'opens-later', opensAt: upcoming.open } : { state: 'closed' }
}
