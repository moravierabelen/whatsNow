import { MapPinSimpleIcon } from '@phosphor-icons/react'
import type { Event } from '../../domain/events/event'
import { CATEGORY_ICON } from './categoryPresentation'
import { displayEventName, formatPrice } from './eventDisplay'
import { EventThumbnail } from './EventThumbnail'
import { LiveDot } from './LiveDot'

interface FeaturedEventProps {
  event: Event
  live: boolean
  /** Pre-formatted by the caller (`formatEventTime`) — this component stays
   * presentational and doesn't need `referenceTime` itself. */
  timeLabel: string
}

/**
 * The one event shown alongside the map — see `selectFeaturedEvent`. Links
 * out to the event's real page via the "View tickets" CTA below — no
 * in-app detail page yet. The price line intentionally does NOT fall back
 * to a "View tickets" link the way `EventListItem`'s does: this card
 * already has that single CTA, so a second one in the price slot would
 * just repeat it. When there's no usable price, the segment is omitted
 * entirely rather than showing a dead-end "Price TBA".
 *
 * Category is an accent-colored icon leading the title (no text label,
 * and the same single accent color regardless of category — see
 * `EventListItem`, same convention); a live event shows the same
 * dot+"Live now" badge in that slot instead.
 */
export function FeaturedEvent({ event, live, timeLabel }: FeaturedEventProps) {
  const price = formatPrice(event.priceRange)
  const CategoryIcon = CATEGORY_ICON[event.category]

  return (
    <a
      href={event.url}
      target="_blank"
      rel="noopener noreferrer"
      className="card-panel flex flex-col overflow-hidden border border-border-strong bg-surface lg:h-full"
    >
      <EventThumbnail event={event} variant="hero" className="h-40 w-full shrink-0 sm:h-44 lg:h-auto lg:flex-[0_0_44%]" />
      <div className="flex flex-1 flex-col gap-2 p-5 sm:p-6">
        <h3 className="flex items-center gap-1.5 text-xl font-semibold leading-snug text-ink sm:text-[22px]">
          {live ? (
            <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-accent">
              <LiveDot />
              Live now
            </span>
          ) : (
            <CategoryIcon className="h-3.5 w-3.5 shrink-0 text-accent" weight="bold" aria-hidden="true" />
          )}
          <span>{displayEventName(event)}</span>
        </h3>
        <div className="flex flex-col gap-1 text-sm text-ink-muted">
          <span className="flex items-center gap-1 truncate">
            {/* MapPinSimpleIcon's glyph is inset ~27% inside its own box
                (unlike the category icon above, which fills its box) — the
                negative margin pulls its visible ink back to the same left
                edge as the category icon / the time line below it. */}
            <MapPinSimpleIcon className="-ml-1 h-3.5 w-3.5 shrink-0" weight="bold" aria-hidden="true" />
            <span className="truncate">{event.venue.name}</span>
          </span>
          <span>
            {live ? 'Live now' : <span className="font-mono">{timeLabel}</span>}
            {price && (
              <>
                {' · '}
                <span className="font-mono">{price}</span>
              </>
            )}
          </span>
        </div>
        <span className="mt-auto flex items-center gap-1 pt-4 text-xs font-semibold text-accent">
          View tickets
          <span aria-hidden="true">→</span>
        </span>
      </div>
    </a>
  )
}
