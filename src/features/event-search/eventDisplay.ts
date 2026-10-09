import { TZDate } from '@date-fns/tz'
import { addDays, differenceInCalendarDays, format, isSameDay } from 'date-fns'
import type { Event, PriceRange } from '../../domain/events/event'
import { resolveOpenState } from '../../domain/events/openingHours'
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

/** Any longer and the weekday names repeat, so "Mon–Mon" would locate nothing. */
const SHORT_RUN_DAYS = 6

/**
 * How long a drop-in plan runs: "Fri–Sat" while weekday names still place it,
 * "Until Oct 12" once they don't. `undefined` for a single day.
 */
export function formatRunExtent(event: Pick<Event, 'start' | 'endDate'>): string | undefined {
  if (event.start.timeKnown || !event.endDate) return undefined
  const { timeZone } = event.start
  const startZoned = new TZDate(event.start.utc, timeZone)
  const endZoned = new TZDate(`${event.endDate}T00:00:00`, timeZone)
  if (isSameDay(startZoned, endZoned)) return undefined

  return differenceInCalendarDays(endZoned, startZoned) <= SHORT_RUN_DAYS
    ? `${format(startZoned, 'EEE')}–${format(endZoned, 'EEE')}`
    : `Until ${format(endZoned, 'MMM d')}`
}

/**
 * What a drop-in plan offers on the reference day: its hours when the source
 * states them, the run's extent when it doesn't.
 */
export function formatOpenState(
  event: Pick<Event, 'start' | 'endDate' | 'openingHours'>,
  referenceTime: string,
): string {
  const { timeZone } = event.start
  const open = resolveOpenState(event.openingHours, referenceTime, timeZone)
  const clock = (instant: number) => format(new TZDate(instant, timeZone), 'HH:mm')

  if (open.state === 'open') return `Open now · until ${clock(open.closesAt)}`
  if (open.state === 'opens-later') return `Opens ${clock(open.opensAt)}`
  return formatRunExtent(event) ?? 'Hours not listed'
}

/**
 * "Today, 20:00" / "Tomorrow, 20:00" / "Fri, Sep 25 · 20:00", in the venue's
 * timezone. For a plan that starts at a time; see `formatOpenState` otherwise.
 */
export function formatEventTime(event: Pick<Event, 'start'>, referenceTime: string): string {
  const { utc, timeZone, timeKnown } = event.start
  const zoned = new TZDate(utc, timeZone)
  const now = new TZDate(referenceTime, timeZone)
  const timePart = timeKnown ? format(zoned, 'HH:mm') : 'Time TBA'
  if (isSameDay(zoned, now)) return `Today, ${timePart}`
  if (isSameDay(zoned, addDays(now, 1))) return `Tomorrow, ${timePart}`
  return `${format(zoned, 'EEE, MMM d')} · ${timePart}`
}

/** Whichever kind of plan it is, labelled the way its own section would. */
export function formatEventSchedule(
  event: Pick<Event, 'start' | 'endDate' | 'openingHours'>,
  referenceTime: string,
): string {
  return event.start.timeKnown ? formatEventTime(event, referenceTime) : formatOpenState(event, referenceTime)
}

export function formatWeekdayTime(event: Pick<Event, 'start'>): string {
  const { utc, timeZone, timeKnown } = event.start
  const zoned = new TZDate(utc, timeZone)
  const weekday = format(zoned, 'EEE')
  if (!timeKnown) return `${weekday} · Time TBA`
  return `${weekday} ${format(zoned, 'HH:mm')}`
}

export function isEventLiveNow(event: Event, referenceTime: string): boolean {
  return classifyNowBucket(event, referenceTime, event.start.timeZone) === 'happening-now'
}

/** Live, or close enough that "right now" is a fair thing to promise. */
export function isEventImminent(event: Event, referenceTime: string): boolean {
  const bucket = classifyNowBucket(event, referenceTime, event.start.timeZone)
  return bucket === 'happening-now' || bucket === 'starting-soon'
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
