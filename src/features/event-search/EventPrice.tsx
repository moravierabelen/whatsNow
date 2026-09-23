import { ArrowSquareOutIcon } from '@phosphor-icons/react'
import type { PriceRange } from '../../domain/events/event'
import { formatPrice } from './eventDisplay'

/**
 * The price slot: formatted price when we have one, otherwise "View
 * tickets" — every `Event` always has a real ticketing `url` (the parent
 * card/row is already a link to it), so there's no case left where a bare
 * "Price TBA" is the only honest option.
 */
export function EventPrice({ priceRange }: { priceRange: PriceRange | undefined }) {
  const price = formatPrice(priceRange)
  if (price) return <span className="font-mono">{price}</span>

  return (
    <span className="inline-flex items-center gap-1">
      View tickets
      <ArrowSquareOutIcon className="h-3 w-3 shrink-0" weight="bold" aria-hidden="true" />
    </span>
  )
}
