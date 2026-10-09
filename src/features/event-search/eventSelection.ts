import { TZDate } from '@date-fns/tz'
import type { Event } from '../../domain/events/event'
import { OPEN_STATE_RANK, resolveOpenState, type OpenState } from '../../domain/events/openingHours'
import { isEventLiveNow } from './eventDisplay'

/**
 * Picks which event renders in the featured panel. Not editorial
 * "featured" content — just a reasonable initial focus (prefers an event
 * with an image, and whatever's happening right now), since there is no
 * map/list selection state yet in this pass. Ported from the equivalent
 * `pickDefaultSelection` heuristic in the foundation UI exploration.
 *
 * Events with an unknown start time (`timeKnown: false`) are never
 * eligible — the hero implies "this is happening at this moment", which we
 * can't honestly claim without a real time.
 */
export function selectFeaturedEvent(events: Event[], referenceTime: string): Event | undefined {
  const candidates = events.filter((event) => event.start.timeKnown)
  if (candidates.length === 0) return undefined
  const ranked = [...candidates].sort((a, b) => {
    const aScore = (a.image ? 0 : 1) - (isEventLiveNow(a, referenceTime) ? 1 : 0)
    const bScore = (b.image ? 0 : 1) - (isEventLiveNow(b, referenceTime) ? 1 : 0)
    if (aScore !== bScore) return aScore - bScore
    return new Date(a.start.utc).getTime() - new Date(b.start.utc).getTime()
  })
  return ranked[0]
}

/**
 * Chronological order. `searchEvents` concatenates each provider's results
 * (Ticketmaster's own results are already date-sorted, JamBase's are too,
 * but the combined list is not — see `searchEvents.ts`) — every rendered
 * listing needs this, not just providers that happen to return sorted data.
 */
export function sortByStart(events: Event[]): Event[] {
  return [...events].sort((a, b) => new Date(a.start.utc).getTime() - new Date(b.start.utc).getTime())
}

export interface EventSections {
  /** Plans you have to be at by a certain time. */
  timed: Event[]
  /** Plans you can drop into while they are open. */
  open: Event[]
}

/** Whatever the state, the soonest thing to act on sorts first. */
function openSortKey(event: Event, open: OpenState): number {
  if (open.state === 'open') return open.closesAt
  if (open.state === 'opens-later') return open.opensAt
  return event.endDate
    ? new TZDate(`${event.endDate}T00:00:00`, event.start.timeZone).getTime()
    : new Date(event.start.utc).getTime()
}

function sortOpenRuns(events: Event[], referenceTime: string): Event[] {
  return events
    .map((event) => ({ event, open: resolveOpenState(event.openingHours, referenceTime, event.start.timeZone) }))
    .sort(
      (a, b) =>
        OPEN_STATE_RANK[a.open.state] - OPEN_STATE_RANK[b.open.state] ||
        openSortKey(a.event, a.open) - openSortKey(b.event, b.open),
    )
    .map(({ event }) => event)
}

/**
 * Splits on the only distinction the reader acts on: whether they have to be
 * somewhere at a time, or can go whenever the doors are open.
 */
export function splitByTiming(events: Event[], referenceTime: string): EventSections {
  return {
    timed: sortByStart(events.filter((event) => event.start.timeKnown)),
    open: sortOpenRuns(
      events.filter((event) => !event.start.timeKnown),
      referenceTime,
    ),
  }
}
