import { TZDate } from '@date-fns/tz'
import { addDays, format, isSameDay } from 'date-fns'
import type { Event, PriceRange } from '../../domain/events/event'
import { classifyNowBucket } from '../../domain/events/temporal'

/** Pure display formatting for `Event` — not business logic, just text. */

/** `undefined` when there is no usable price data, rather than a fabricated "TBA". */
export function formatPrice(priceRange: PriceRange | undefined): string | undefined {
  if (!priceRange) return undefined
  const { min, max, currency } = priceRange
  if (min === undefined && max === undefined) return undefined
  if ((min ?? 0) === 0 && (max ?? 0) === 0) return 'Free'
  if (min !== undefined && max !== undefined && max !== min) return `From ${min} ${currency}`
  return `${min ?? max} ${currency}`
}

/**
 * "Fri–Sat" for a multi-day event with no confirmed time; `undefined` otherwise.
 * A known start time always wins: a show running past midnight is still one day.
 */
function formatDayRange(event: Pick<Event, 'start' | 'endDate'>): string | undefined {
  if (event.start.timeKnown || !event.endDate) return undefined
  const { timeZone } = event.start
  const startZoned = new TZDate(event.start.utc, timeZone)
  const endZoned = new TZDate(`${event.endDate}T00:00:00`, timeZone)
  if (isSameDay(startZoned, endZoned)) return undefined
  return `${format(startZoned, 'EEE')}–${format(endZoned, 'EEE')}`
}

/** "Today, 20:00" / "Tomorrow, 20:00" / "Fri, Sep 25 · 20:00", in the venue's timezone. */
export function formatEventTime(
  event: Pick<Event, 'start' | 'endDate'>,
  referenceTime: string,
): string {
  const range = formatDayRange(event)
  if (range) return range

  const { utc, timeZone, timeKnown } = event.start
  const zoned = new TZDate(utc, timeZone)
  const now = new TZDate(referenceTime, timeZone)
  const timePart = timeKnown ? format(zoned, 'HH:mm') : 'Time TBA'
  if (isSameDay(zoned, now)) return `Today, ${timePart}`
  if (isSameDay(zoned, addDays(now, 1))) return `Tomorrow, ${timePart}`
  return `${format(zoned, 'EEE, MMM d')} · ${timePart}`
}

export function formatWeekdayTime(event: Pick<Event, 'start' | 'endDate'>): string {
  const range = formatDayRange(event)
  if (range) return range

  const { utc, timeZone, timeKnown } = event.start
  const zoned = new TZDate(utc, timeZone)
  const weekday = format(zoned, 'EEE')
  if (!timeKnown) return `${weekday} · Time TBA`
  return `${weekday} ${format(zoned, 'HH:mm')}`
}

export function isEventLiveNow(event: Event, referenceTime: string): boolean {
  return classifyNowBucket(event, referenceTime, event.start.timeZone) === 'happening-now'
}

/**
 * Strips the venue some providers bake into the name ("Artist at Venue"), which
 * every card already shows separately. Matched against this event's own venue so
 * a name containing " at " ("Meet Me At The Altar") survives intact.
 */
export function displayEventName(event: Pick<Event, 'name' | 'venue'>): string {
  const suffix = ` at ${event.venue.name}`
  const { name } = event
  if (name.length > suffix.length && name.toLowerCase().endsWith(suffix.toLowerCase())) {
    return name.slice(0, name.length - suffix.length).trim()
  }
  return name
}
