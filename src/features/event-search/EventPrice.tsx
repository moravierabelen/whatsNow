import { ArrowSquareOutIcon } from '@phosphor-icons/react'
import type { PriceRange } from '../../domain/events/event'
import { formatPrice } from './eventDisplay'

interface EventPriceProps {
  priceRange: PriceRange | undefined
  /** Whether the surrounding card actually links out (see `Event.url`). */
  hasLink: boolean
}

/** Price when known, else "View tickets" — but never a CTA on a card that links nowhere. */
export function EventPrice({ priceRange, hasLink }: EventPriceProps) {
  const price = formatPrice(priceRange)
  if (price) return <span className="font-mono">{price}</span>
  if (!hasLink) return null

  return (
    <span className="inline-flex items-center gap-1">
      View tickets
      <ArrowSquareOutIcon className="h-3 w-3 shrink-0" weight="bold" aria-hidden="true" />
    </span>
  )
}
