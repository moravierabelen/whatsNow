import type { Event } from '../../domain/events/event'
import { EventThumbnail } from './EventThumbnail'
import { LiveDot } from './LiveDot'

/**
 * "Happening now" — a visual, horizontal discovery card, deliberately not
 * another agenda row: bigger image, one strong title, a single line of
 * venue metadata. Every event here is already "happening now" by
 * construction, so the live badge is constant, not conditional.
 */
export function HappeningNowCard({ event }: { event: Event }) {
  return (
    <a
      href={event.url}
      target="_blank"
      rel="noopener noreferrer"
      className="happening-card group flex w-full shrink-0 flex-col overflow-hidden text-left"
    >
      <div className="happening-card-image relative aspect-[4/3] w-full overflow-hidden">
        <EventThumbnail event={event} variant="hero" className="h-full w-full" />
        <span className="absolute left-1.5 top-1.5 flex items-center gap-1 bg-ink px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
          <LiveDot />
          Live now
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-0.5 pt-2">
        <h3 className="font-display text-sm font-semibold leading-snug text-ink">{event.name}</h3>
        <p className="truncate text-xs text-ink-muted">{event.venue.name}</p>
      </div>
    </a>
  )
}
