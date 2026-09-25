import { TZDate } from '@date-fns/tz'
import { addDays, format, isSameDay } from 'date-fns'
import type { Event, PriceRange } from '../../domain/events/event'
import { classifyNowBucket } from '../../domain/events/temporal'

/** Pure display formatting for `Event` — not business logic, just text. */

/** `undefined` when there's no usable price data — every `Event` always has
 * a real ticketing `url`, so callers show a "View tickets" link instead of
 * fabricating a price or a bare "TBA". */
export function formatPrice(priceRange: PriceRange | undefined): string | undefined {
  if (!priceRange) return undefined
  const { min, max, currency } = priceRange
  if (min === undefined && max === undefined) return undefined
  if ((min ?? 0) === 0 && (max ?? 0) === 0) return 'Free'
  if (min !== undefined && max !== undefined && max !== min) return `From ${min} ${currency}`
  return `${min ?? max} ${currency}`
}

/**
 * "Fri–Sat" for a genuinely multi-day, no-confirmed-time event (a JamBase
 * festival listing with only a start/end *date*, e.g. "2026-09-25" –
 * "2026-09-26") — `undefined` for every other case, so callers fall
 * through to their own single-day formatting.
 *
 * A known start *time* always wins over `endDate`: per product rule, a
 * show starting Monday 23:00 and running past midnight into Tuesday is
 * still "Mon 23:00", never a range — so this only ever consults `endDate`
 * when `start.timeKnown` is false (see `Event.endDate`'s doc comment).
 * The range is absolute (real weekday labels from `start`/`endDate`), not
 * relative to `referenceTime` — it stays "Fri–Sat" no matter which day of
 * the event it's viewed from, which is the whole point of showing a range
 * instead of a single relative day.
 */
function formatDayRange(event: Pick<Event, 'start' | 'endDate'>): string | undefined {
  if (event.start.timeKnown || !event.endDate) return undefined
  const { timeZone } = event.start
  const startZoned = new TZDate(event.start.utc, timeZone)
  const endZoned = new TZDate(`${event.endDate}T00:00:00`, timeZone)
  // `endDate` is only meant to be set when it's genuinely different from
  // start's own local date (see `Event.endDate`'s doc comment) — checked
  // again here so this function is correct on its own terms, not just by
  // relying on callers/mappers to uphold that invariant upstream.
  if (isSameDay(startZoned, endZoned)) return undefined
  return `${format(startZoned, 'EEE')}–${format(endZoned, 'EEE')}`
}

/** "Today, 20:00" / "Tomorrow, 20:00" / "Fri, Sep 25 · 20:00" — or, when the
 * event only has a known date (`timeKnown: false`), "Today, Time TBA" /
 * "Tomorrow, Time TBA" / "Fri, Sep 25 · Time TBA". A genuinely multi-day
 * date-only event (see `formatDayRange`) short-circuits all of that in
 * favor of an absolute range, e.g. "Fri–Sat" — "Today, Time TBA" would be
 * both less useful and inaccurate on the event's later days. In the
 * event's own venue timezone — each `Event` already carries one.
 * `referenceTime` is explicit, never read from the system clock here, same
 * rule as the rest of this codebase (see `temporal.ts`). */
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

/** Short weekday + time, for listings that mix multiple days (e.g.
 * Weekend) where "Today"/"Tomorrow" framing and a full date don't fit a
 * narrow column: "Fri 20:30", or "Fri · Time TBA" when the time isn't
 * known — or, for a genuinely multi-day date-only event, "Fri–Sat" (see
 * `formatDayRange`; no "Time TBA" alongside it, the range alone already
 * says enough). No `referenceTime` needed — unlike `formatEventTime`,
 * this never varies by how far away "today" is. */
export function formatWeekdayTime(event: Pick<Event, 'start' | 'endDate'>): string {
  const range = formatDayRange(event)
  if (range) return range

  const { utc, timeZone, timeKnown } = event.start
  const zoned = new TZDate(utc, timeZone)
  const weekday = format(zoned, 'EEE')
  if (!timeKnown) return `${weekday} · Time TBA`
  return `${weekday} ${format(zoned, 'HH:mm')}`
}

/** Whether an event is happening right now — reuses the domain's own
 * classification rather than re-deriving "live" from scratch. */
export function isEventLiveNow(event: Event, referenceTime: string): boolean {
  return classifyNowBucket(event, referenceTime, event.start.timeZone) === 'happening-now'
}

/**
 * Some providers (JamBase, notably) bake the venue into the event name
 * itself, e.g. "Fritz Kalkbrenner at SEASEACLUB" — every renderer that
 * shows this name also shows the venue separately right below it, so
 * left as-is it reads as duplicated information. Strips a trailing
 * " at <venue>" only when it names *this exact* event's own venue
 * (case-insensitive) — never a blind "cut everything after the last
 * ' at '", which would wrongly mangle a real artist/event name that
 * happens to contain " at " (e.g. a band literally called "Meet Me At
 * The Altar"). Falls back to the full name whenever the suffix doesn't
 * match, or stripping it would leave nothing.
 */
export function displayEventName(event: Pick<Event, 'name' | 'venue'>): string {
  const suffix = ` at ${event.venue.name}`
  const { name } = event
  if (name.length > suffix.length && name.toLowerCase().endsWith(suffix.toLowerCase())) {
    return name.slice(0, name.length - suffix.length).trim()
  }
  return name
}
