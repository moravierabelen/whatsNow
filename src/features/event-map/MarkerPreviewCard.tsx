import { XIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import type { Event } from '../../domain/events/event'
import { displayEventName, formatEventTime } from '../event-search/eventDisplay'
import { EventThumbnail } from '../event-search/EventThumbnail'

const EXIT_DURATION_MS = 180

interface MarkerPreviewCardProps {
  /** `null` when no marker is selected — the card hides itself. */
  event: Event | null
  referenceTime: string
  onClose: () => void
}

/**
 * Small event preview shown inside the map when an individual marker is
 * selected — replaces Leaflet's native popup (name-only) with something
 * that actually looks like whatsnow. Reuses `EventThumbnail` and
 * `formatEventTime` rather than re-deriving image/time presentation, and
 * deliberately stays minimal: image, name, venue, time — no price,
 * category, or CTA, and no link to `FeaturedEvent`, which this never
 * touches.
 *
 * Owns its own enter/exit transition since nothing in this project
 * provides one: on deselect (`event` -> null) it keeps rendering the last
 * event for `EXIT_DURATION_MS` while fading/sliding out, then unmounts —
 * a plain conditional render would cut the exit animation off instantly.
 * Switching directly from one marker to another swaps the card's content
 * in place, without re-running the enter animation.
 */
export function MarkerPreviewCard({ event, referenceTime, onClose }: MarkerPreviewCardProps) {
  const [renderedEvent, setRenderedEvent] = useState<Event | null>(null)
  const [visible, setVisible] = useState(false)
  const [lastEventProp, setLastEventProp] = useState<Event | null>(null)

  // Adjust state during rendering in response to the `event` prop
  // changing, instead of mirroring it via an effect (React's own
  // recommended alternative — see "You Might Not Need an Effect").
  if (event !== lastEventProp) {
    setLastEventProp(event)
    if (event) {
      setRenderedEvent(event)
      // Only reset to hidden on a *fresh* selection (nothing was shown
      // before) — the enter effect below then animates it in. Switching
      // between two already-visible markers leaves `visible` alone, so
      // the card's content just swaps in place.
      if (renderedEvent === null) setVisible(false)
    } else {
      setVisible(false)
    }
  }

  // Enter: once a fresh selection has been committed hidden above, flip
  // to visible on the next frame so the transition actually plays instead
  // of the card just appearing already in its final state.
  useEffect(() => {
    if (!renderedEvent || visible) return
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [renderedEvent, visible])

  // Exit: `event` went back to null — keep the (now fading-out) card
  // mounted just long enough for the transition to finish, then unmount.
  useEffect(() => {
    if (event !== null || renderedEvent === null) return
    const timeout = setTimeout(() => setRenderedEvent(null), EXIT_DURATION_MS)
    return () => clearTimeout(timeout)
  }, [event, renderedEvent])

  if (!renderedEvent) return null

  return (
    <div
      className={`card-panel absolute inset-x-3 bottom-3 z-1000 flex w-auto items-start gap-2.5 border border-border-strong bg-surface p-2.5 shadow-lifted transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none lg:inset-x-auto lg:bottom-9 lg:right-3 lg:w-64 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
      }`}
    >
      <EventThumbnail event={renderedEvent} variant="thumb" className="h-12 w-12 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink">{displayEventName(renderedEvent)}</p>
        <p className="mt-0.5 truncate text-xs text-ink-muted">{renderedEvent.venue.name}</p>
        <p className="mt-0.5 truncate font-mono text-xs text-ink-muted">{formatEventTime(renderedEvent, referenceTime)}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close event preview"
        className="-m-1 shrink-0 rounded-full p-1 text-ink-faint transition-colors hover:text-ink"
      >
        <XIcon className="h-3.5 w-3.5" weight="bold" aria-hidden="true" />
      </button>
    </div>
  )
}
