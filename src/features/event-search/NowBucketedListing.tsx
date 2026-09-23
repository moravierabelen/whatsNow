import type { Event } from '../../domain/events/event'
import { EventListItem } from './EventListItem'
import { formatEventTime } from './eventDisplay'
import { groupByNowBucket } from './eventSelection'
import { HappeningNowRail } from './HappeningNowRail'
import { SectionLabel } from './SectionLabel'

/** "Now" mode's secondary listing splits into three groups instead of one
 * flat list — see `groupByNowBucket`/`classifyNowBucket`. Only "Happening
 * now" gets the rail treatment; the other two groups are plain rows, same
 * as every other time mode. */
export function NowBucketedListing({ events, referenceTime }: { events: Event[]; referenceTime: string }) {
  const buckets = groupByNowBucket(events, referenceTime)

  return (
    <div className="flex flex-col gap-8">
      {buckets.happeningNow.length > 0 && (
        <div>
          <SectionLabel count={buckets.happeningNow.length}>Happening now</SectionLabel>
          <HappeningNowRail events={buckets.happeningNow} />
        </div>
      )}
      {buckets.startingSoon.length > 0 && (
        <div>
          <SectionLabel count={buckets.startingSoon.length}>Starting soon</SectionLabel>
          <ul className="listing-grid grid grid-cols-1 lg:grid-cols-2 lg:gap-x-12">
            {buckets.startingSoon.map((event) => (
              <EventListItem key={event.id} event={event} live={false} timeLabel={formatEventTime(event, referenceTime)} />
            ))}
          </ul>
        </div>
      )}
      {buckets.laterToday.length > 0 && (
        <div>
          <SectionLabel count={buckets.laterToday.length}>Later today</SectionLabel>
          <ul className="listing-grid grid grid-cols-1 lg:grid-cols-2 lg:gap-x-12">
            {buckets.laterToday.map((event) => (
              <EventListItem key={event.id} event={event} live={false} timeLabel={formatEventTime(event, referenceTime)} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
