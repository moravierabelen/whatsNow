import { MapPinSimpleIcon } from '@phosphor-icons/react'
import type { Event } from '../../domain/events/event'
import { CATEGORY_ICON } from './categoryPresentation'
import { displayEventName } from './eventDisplay'
import { MaybeLink } from './MaybeLink'
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
 * `listing-row` must stay on the `<li>`: its CSS uses `:nth-child` to drop the
 * top border on the first row(s), which only works among `<ul>`'s own children.
 */
export function EventListItem({ event, live, timeLabel }: EventListItemProps) {
  const CategoryIcon = CATEGORY_ICON[event.category]

  // Rendered twice: the leading column on `sm`+, the metadata line on phones.
  const timeContent = live ? (
    <>
      <LiveDot />
      <span className="text-accent">Live</span>
    </>
  ) : (
    timeLabel.replace(/^(Today|Tomorrow), /, '')
  )

  return (
    <li className="listing-row">
      <MaybeLink
        href={event.url}
        className="group grid w-full grid-cols-[56px_1fr] items-center gap-3 py-4 text-left transition-colors duration-200 sm:grid-cols-[60px_64px_1fr] sm:gap-4 sm:py-3.5"
      >
        <span className="listing-time hidden font-mono text-xs text-ink-muted sm:flex sm:items-center sm:gap-1.5">
          {timeContent}
        </span>
        <EventThumbnail event={event} variant="thumb" className="aspect-square w-full" />
        <div className="flex min-w-0 flex-col gap-1.5">
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
          {/* Wraps on phones so the venue gets a full row instead of truncating. */}
          <div className="listing-meta flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
            <span className="flex min-w-0 basis-full items-center gap-1 sm:basis-auto sm:flex-1">
              {/* The pin glyph sits ~27% inside its own box; this pulls it back into line. */}
              <MapPinSimpleIcon className="-ml-1 h-3.5 w-3.5 shrink-0" weight="bold" aria-hidden="true" />
              <span className="truncate">{event.venue.name}</span>
            </span>
            {/* The leading time column is hidden below `sm`. */}
            <span className="listing-time flex shrink-0 items-center gap-1.5 font-mono sm:hidden">{timeContent}</span>
            <span className="listing-price ml-auto shrink-0 text-right transition-colors duration-200">
              <EventPrice priceRange={event.priceRange} hasLink={Boolean(event.url)} />
            </span>
          </div>
        </div>
      </MaybeLink>
    </li>
  )
}
