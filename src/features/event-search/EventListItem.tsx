import type { Event } from '../../domain/events/event'
import { CATEGORY_LABEL } from './categoryPresentation'
import { EventPrice } from './EventPrice'
import { EventThumbnail } from './EventThumbnail'
import { LiveDot } from './LiveDot'

interface EventListItemProps {
  event: Event
  live: boolean
  /** Pre-formatted by the caller (`formatEventTime`) — this component stays
   * presentational and doesn't need `referenceTime` itself. */
  timeLabel: string
}

/**
 * "More plans" — a listings-page row, not a product card: time leads, then
 * a small square thumbnail, then title/venue/category, then price
 * trailing right. Links out to the event's real ticketing/info page — no
 * in-app event detail page exists yet.
 *
 * `listing-row` (the border/hover treatment, see index.css) lives on the
 * `<li>` itself, not the inner `<a>` — its CSS relies on `:nth-child` to
 * drop the top border on the first row(s), which only targets the right
 * elements if `.listing-row` sits directly among `<ul>`'s children.
 */
export function EventListItem({ event, live, timeLabel }: EventListItemProps) {
  return (
    <li className="listing-row">
      <a
        href={event.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group grid w-full grid-cols-[56px_1fr_auto] items-center gap-3 py-3.5 text-left transition-colors duration-200 sm:grid-cols-[60px_64px_1fr_auto] sm:gap-4"
      >
        <span className="listing-time hidden font-mono text-xs text-ink-muted sm:flex sm:items-center sm:gap-1.5">
          {live ? (
            <>
              <LiveDot />
              <span className="text-accent">Live</span>
            </>
          ) : (
            timeLabel.replace(/^(Today|Tomorrow), /, '')
          )}
        </span>
        <EventThumbnail event={event} variant="thumb" className="aspect-square w-full" />
        <div className="min-w-0">
          <h3 className="listing-title line-clamp-2 text-[15px] font-semibold leading-snug text-ink">{event.name}</h3>
          <p className="listing-meta flex items-center gap-1.5 truncate text-xs text-ink-muted">
            {live && <LiveDot className="sm:hidden" />}
            <span className="truncate">
              <span style={{ color: live ? 'var(--color-accent)' : undefined }}>
                {live ? 'Live now' : CATEGORY_LABEL[event.category]}
              </span>
              {' · '}
              {event.venue.name}
            </span>
          </p>
        </div>
        <span className="listing-price shrink-0 text-right text-xs text-ink-muted transition-colors duration-200">
          <EventPrice priceRange={event.priceRange} />
        </span>
      </a>
    </li>
  )
}
