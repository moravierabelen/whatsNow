import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MaybeLink } from './MaybeLink'

describe('MaybeLink', () => {
  it('renders a link that opens safely in a new tab when there is a destination', () => {
    render(
      <MaybeLink href="https://example.com/event" className="card">
        Some event
      </MaybeLink>,
    )

    const link = screen.getByRole('link', { name: 'Some event' })
    expect(link).toHaveAttribute('href', 'https://example.com/event')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders the same content without a link when there is nowhere to go', () => {
    render(<MaybeLink className="card">Some event</MaybeLink>)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('Some event')).toBeInTheDocument()
  })

  it('keeps the card styling either way, so an unlinked card looks the same', () => {
    const { container: linked } = render(
      <MaybeLink href="https://example.com" className="card-panel flex">
        x
      </MaybeLink>,
    )
    const { container: plain } = render(
      <MaybeLink className="card-panel flex">x</MaybeLink>,
    )

    expect(linked.firstElementChild).toHaveClass('card-panel', 'flex')
    expect(plain.firstElementChild).toHaveClass('card-panel', 'flex')
  })
})
