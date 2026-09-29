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
 * Replaces Leaflet's native marker popup. Keeps rendering the last event for
 * `EXIT_DURATION_MS` after deselection so the exit transition can finish.
 */
export function MarkerPreviewCard({ event, referenceTime, onClose }: MarkerPreviewCardProps) {
  const [renderedEvent, setRenderedEvent] = useState<Event | null>(null)
  const [visible, setVisible] = useState(false)
  const [lastEventProp, setLastEventProp] = useState<Event | null>(null)

  // Adjusting state during render, rather than mirroring a prop via an effect.
  if (event !== lastEventProp) {
    setLastEventProp(event)
    if (event) {
      setRenderedEvent(event)
      // Only a fresh selection animates in; switching markers swaps content in place.
      if (renderedEvent === null) setVisible(false)
    } else {
      setVisible(false)
    }
  }

  // Flip to visible a frame later, so the transition has a hidden state to play from.
  useEffect(() => {
    if (!renderedEvent || visible) return
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [renderedEvent, visible])

  // Unmount only after the exit transition has had time to run.
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
