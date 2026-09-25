import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Event } from '../../domain/events/event'
import { MarkerPreviewCard } from './MarkerPreviewCard'

const REFERENCE_TIME = '2026-09-19T10:00:00.000Z'

function event(overrides: Partial<Event> = {}): Event {
  return {
    id: 'evt-1',
    source: { provider: 'ticketmaster', externalId: 'evt-1' },
    name: 'Test Concert',
    category: 'music',
    start: { utc: '2026-09-19T18:30:00.000Z', timeZone: 'Europe/Madrid', timeKnown: true },
    venue: { name: 'Test Venue', coordinates: { latitude: 41.38, longitude: 2.17 } },
    url: 'https://example.com/event',
    ...overrides,
  }
}

describe('MarkerPreviewCard', () => {
  it('renders nothing when no event is selected', () => {
    const { container } = render(
      <MarkerPreviewCard event={null} referenceTime={REFERENCE_TIME} onClose={vi.fn()} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('shows the minimal content set — image alt, name, venue, time — for the selected event', () => {
    render(<MarkerPreviewCard event={event()} referenceTime={REFERENCE_TIME} onClose={vi.fn()} />)

    expect(screen.getByText('Test Concert')).toBeInTheDocument()
    expect(screen.getByText('Test Venue')).toBeInTheDocument()
    expect(screen.getByText('Today, 20:30')).toBeInTheDocument()
  })

  it('does not render price, category, or a ticket CTA', () => {
    render(
      <MarkerPreviewCard
        event={event({ priceRange: { currency: 'EUR', min: 20, max: 40 } })}
        referenceTime={REFERENCE_TIME}
        onClose={vi.fn()}
      />,
    )

    expect(screen.queryByText(/EUR/)).not.toBeInTheDocument()
    expect(screen.queryByText('Music')).not.toBeInTheDocument()
    expect(screen.queryByText('View tickets')).not.toBeInTheDocument()
  })

  it('swaps content in place when the selected event changes directly (no re-render gap)', () => {
    const { rerender } = render(
      <MarkerPreviewCard event={event()} referenceTime={REFERENCE_TIME} onClose={vi.fn()} />,
    )
    expect(screen.getByText('Test Concert')).toBeInTheDocument()

    const other = event({ id: 'evt-2', name: 'Other Show', venue: { name: 'Other Venue', coordinates: { latitude: 41.4, longitude: 2.2 } } })
    rerender(<MarkerPreviewCard event={other} referenceTime={REFERENCE_TIME} onClose={vi.fn()} />)

    expect(screen.getByText('Other Show')).toBeInTheDocument()
    expect(screen.getByText('Other Venue')).toBeInTheDocument()
    expect(screen.queryByText('Test Concert')).not.toBeInTheDocument()
  })

  it('keeps rendering the last event briefly after deselecting, for the exit transition, then removes it', async () => {
    vi.useFakeTimers()
    try {
      const { container, rerender } = render(
        <MarkerPreviewCard event={event()} referenceTime={REFERENCE_TIME} onClose={vi.fn()} />,
      )
      expect(screen.getByText('Test Concert')).toBeInTheDocument()

      rerender(<MarkerPreviewCard event={null} referenceTime={REFERENCE_TIME} onClose={vi.fn()} />)
      // Still present immediately after deselecting — mid exit-transition.
      expect(screen.getByText('Test Concert')).toBeInTheDocument()

      act(() => vi.runAllTimers())
      expect(container).toBeEmptyDOMElement()
    } finally {
      vi.useRealTimers()
    }
  })

  it('calls onClose when the close button is clicked', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const onClose = vi.fn()
    render(<MarkerPreviewCard event={event()} referenceTime={REFERENCE_TIME} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Close event preview' }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
