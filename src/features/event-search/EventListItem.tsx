import { MapPinSimpleIcon } from '@phosphor-icons/react'
import type { Event } from '../../domain/events/event'
import { CATEGORY_ICON } from './categoryPresentation'
import { displayEventName } from './eventDisplay'
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
 * a small square thumbnail, then a title (category icon leading it,
 * no category text) and a venue line (pin icon leading it) with the
 * price/CTA pinned to that same line's right edge. Links out to the
 * event's real ticketing/info page — no in-app event detail page exists
 * yet.
 *
 * The title is free to wrap to two lines without fighting the price/CTA
 * for width — that only shares a line with the (shorter, single-line)
 * venue, not the title.
 *
 * `listing-row` (the border/hover treatment, see index.css) lives on the
 * `<li>` itself, not the inner `<a>` — its CSS relies on `:nth-child` to
 * drop the top border on the first row(s), which only targets the right
 * elements if `.listing-row` sits directly among `<ul>`'s children.
 */
export function EventListItem({ event, live, timeLabel }: EventListItemProps) {
  const CategoryIcon = CATEGORY_ICON[event.category]

  return (
    <li className="listing-row">
      <a
        href={event.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group grid w-full grid-cols-[56px_1fr] items-center gap-3 py-3.5 text-left transition-colors duration-200 sm:grid-cols-[60px_64px_1fr] sm:gap-4"
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
          <h3 className="listing-title flex items-center gap-1.5 text-[15px] font-semibold leading-snug text-ink">
            {live ? (
              <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-accent">
                <LiveDot />
                Live now
              </span>
            ) : (
              <CategoryIcon className="h-3.5 w-3.5 shrink-0 text-accent" weight="bold" aria-hidden="true" />
            )}
            <span className="min-w-0 flex-1 line-clamp-2">{displayEventName(event)}</span>
          </h3>
          <p className="listing-meta mt-1 flex items-center gap-3">
            <span className="flex min-w-0 items-center gap-1 truncate text-xs text-ink-muted">
              {/* MapPinSimpleIcon's glyph is inset ~27% inside its own box
                  (unlike the category icon above, which fills its box) —
                  the negative margin pulls its visible ink back to the
                  same left edge as the category icon / time column text. */}
              <MapPinSimpleIcon className="-ml-1 h-3.5 w-3.5 shrink-0" weight="bold" aria-hidden="true" />
              <span className="truncate">{event.venue.name}</span>
            </span>
            <span className="listing-price ml-auto shrink-0 text-right text-xs text-ink-muted transition-colors duration-200">
              <EventPrice priceRange={event.priceRange} />
            </span>
          </p>
        </div>
      </a>
    </li>
  )
}
