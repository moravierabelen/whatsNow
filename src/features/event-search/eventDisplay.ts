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

/** "Today, 20:00" / "Tomorrow, 20:00" / "Fri, Sep 25 · 20:00", in the
 * event's own venue timezone — each `Event` already carries one.
 * `referenceTime` is explicit, never read from the system clock here, same
 * rule as the rest of this codebase (see `temporal.ts`). */
export function formatEventTime(event: Pick<Event, 'start'>, referenceTime: string): string {
  const { utc, timeZone } = event.start
  const zoned = new TZDate(utc, timeZone)
  const now = new TZDate(referenceTime, timeZone)
  const timePart = format(zoned, 'HH:mm')
  if (isSameDay(zoned, now)) return `Today, ${timePart}`
  if (isSameDay(zoned, addDays(now, 1))) return `Tomorrow, ${timePart}`
  return format(zoned, "EEE, MMM d '·' HH:mm")
}

/** Whether an event is happening right now — reuses the domain's own
 * classification rather than re-deriving "live" from scratch. */
export function isEventLiveNow(event: Event, referenceTime: string): boolean {
  return classifyNowBucket(event, referenceTime, event.start.timeZone) === 'happening-now'
}
