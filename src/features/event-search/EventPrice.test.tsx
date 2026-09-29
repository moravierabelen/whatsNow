import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EventPrice } from './EventPrice'

describe('EventPrice', () => {
  it('shows the formatted price when there is one', () => {
    render(<EventPrice priceRange={{ currency: 'EUR', min: 20, max: 20 }} hasLink />)

    expect(screen.getByText('20 EUR')).toBeInTheDocument()
  })

  it('falls back to "View tickets" when there is no price but the card links out', () => {
    render(<EventPrice priceRange={undefined} hasLink />)

    expect(screen.getByText('View tickets')).toBeInTheDocument()
  })

  it('renders nothing when there is neither a price nor anywhere to go', () => {
    // Promising "View tickets" on a card that does not link anywhere would
    // be a dead end — a public listing with no page of its own.
    const { container } = render(<EventPrice priceRange={undefined} hasLink={false} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('still shows a known price on an unlinked card', () => {
    render(<EventPrice priceRange={{ currency: 'EUR', min: 0, max: 0 }} hasLink={false} />)

    expect(screen.getByText('Free')).toBeInTheDocument()
  })
})
