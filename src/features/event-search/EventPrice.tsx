import { ArrowSquareOutIcon } from '@phosphor-icons/react'
import type { PriceRange } from '../../domain/events/event'
import { formatPrice } from './eventDisplay'

interface EventPriceProps {
  priceRange: PriceRange | undefined
  /** Whether the surrounding card actually links out (see `Event.url`). */
  hasLink: boolean
}

/**
 * Two separate things that used to share this slot: the price is information,
 * the arrow is the affordance. Sharing it meant a priced row offered nothing
 * to click, so "Free" read as a label while being the whole row's link.
 */
export function EventPrice({ priceRange, hasLink }: EventPriceProps) {
  const price = formatPrice(priceRange)
  if (!price && !hasLink) return null

  return (
    <span className="inline-flex items-center gap-1">
      {price && <span className="font-mono">{price}</span>}
      {hasLink && (
        <>
          <span className="sr-only">Opens the event's own page</span>
          <ArrowSquareOutIcon className="h-3 w-3 shrink-0" weight="bold" aria-hidden="true" />
        </>
      )}
    </span>
  )
}
