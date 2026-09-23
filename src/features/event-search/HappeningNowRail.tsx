import { useLayoutEffect, useRef, useState } from 'react'
import type { Event } from '../../domain/events/event'
import { HappeningNowCard } from './HappeningNowCard'

/**
 * "Happening now" must only scroll when there's actually something to
 * scroll to. `outerRef` sits at the normal content width; `rowRef` is the
 * flex row of cards, always laid out `nowrap` + `shrink-0`, so its
 * `scrollWidth` always reflects the cards' true combined width. Comparing
 * the two decides the state on every resize/content change:
 *   - fits: plain, centered, non-scrolling row
 *   - overflows: full-bleed, scrollable rail with a partial next card
 * Ported from the foundation UI exploration's HappeningRail — kept as a
 * real, deliberate interaction, not simplified into a plain vertical list.
 */
export function HappeningNowRail({ events }: { events: Event[] }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)

  useLayoutEffect(() => {
    const outer = outerRef.current
    const row = rowRef.current
    if (!outer || !row) return
    function check() {
      if (!outer || !row) return
      setOverflowing(row.scrollWidth > outer.clientWidth + 1)
    }
    check()
    const observer = new ResizeObserver(check)
    observer.observe(outer)
    observer.observe(row)
    return () => observer.disconnect()
  }, [events])

  return (
    <div ref={outerRef}>
      <div className={overflowing ? 'happening-bleed' : ''}>
        <div
          ref={rowRef}
          className={overflowing ? 'happening-rail flex gap-4 overflow-x-auto px-6 pb-1 lg:px-8' : 'flex justify-center gap-4'}
        >
          {events.map((event) => (
            <HappeningNowCard key={event.id} event={event} />
          ))}
        </div>
      </div>
    </div>
  )
}
