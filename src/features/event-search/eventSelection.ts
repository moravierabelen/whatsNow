import type { Event } from '../../domain/events/event'
import { classifyNowBucket } from '../../domain/events/temporal'
import { isEventLiveNow } from './eventDisplay'

/**
 * Picks which event renders in the featured panel. Not editorial
 * "featured" content — just a reasonable initial focus (prefers an event
 * with an image, and whatever's happening right now), since there is no
 * map/list selection state yet in this pass. Ported from the equivalent
 * `pickDefaultSelection` heuristic in the foundation UI exploration.
 */
export function selectFeaturedEvent(events: Event[], referenceTime: string): Event | undefined {
  if (events.length === 0) return undefined
  const ranked = [...events].sort((a, b) => {
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

export interface NowBuckets {
  happeningNow: Event[]
  startingSoon: Event[]
  laterToday: Event[]
}

/** Splits events into the three "Now" mode groups using the domain's own
 * `classifyNowBucket` — each event is classified against its own venue
 * timezone. Each group comes back chronologically sorted. */
export function groupByNowBucket(events: Event[], referenceTime: string): NowBuckets {
  const buckets: NowBuckets = { happeningNow: [], startingSoon: [], laterToday: [] }
  for (const event of sortByStart(events)) {
    const bucket = classifyNowBucket(event, referenceTime, event.start.timeZone)
    if (bucket === 'happening-now') buckets.happeningNow.push(event)
    else if (bucket === 'starting-soon') buckets.startingSoon.push(event)
    else if (bucket === 'later-today') buckets.laterToday.push(event)
  }
  return buckets
}
