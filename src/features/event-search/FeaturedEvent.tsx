import type { Event } from '../../domain/events/event'
import { CATEGORY_COLOR, CATEGORY_LABEL } from './categoryPresentation'
import { formatPrice } from './eventDisplay'
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
 */
export function FeaturedEvent({ event, live, timeLabel }: FeaturedEventProps) {
  const price = formatPrice(event.priceRange)

  return (
    <a
      href={event.url}
      target="_blank"
      rel="noopener noreferrer"
      className="card-panel flex flex-col overflow-hidden border border-border-strong bg-surface lg:h-full"
    >
      <EventThumbnail event={event} variant="hero" className="h-40 w-full shrink-0 sm:h-44 lg:h-auto lg:flex-[0_0_44%]" />
      <div className="flex flex-1 flex-col gap-2 p-5 sm:p-6">
        <span
          className="flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: live ? 'var(--color-accent)' : CATEGORY_COLOR[event.category] }}
        >
          {live && <LiveDot />}
          {live ? 'Live now' : CATEGORY_LABEL[event.category]}
        </span>
        <h3 className="text-xl font-semibold leading-snug text-ink sm:text-[22px]">{event.name}</h3>
        <div className="flex flex-col gap-1 text-sm text-ink-muted">
          <span className="truncate">{event.venue.name}</span>
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
