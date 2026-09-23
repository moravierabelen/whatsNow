import type { EventCategory } from '../../domain/events/event'

/**
 * Category colors/labels, ported from the foundation UI exploration's
 * `@theme` tokens. Category *icons* are a separate, not-yet-decided piece
 * (Phosphor Icons, mapping TBD) — deliberately not included here.
 */
export const CATEGORY_ORDER: EventCategory[] = ['music', 'sports', 'arts-and-theatre', 'film', 'family', 'other']

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  music: 'Music',
  sports: 'Sports',
  'arts-and-theatre': 'Arts & Theatre',
  film: 'Film',
  family: 'Family',
  other: 'Other',
}

export const CATEGORY_COLOR: Record<EventCategory, string> = {
  music: 'var(--color-cat-music)',
  sports: 'var(--color-cat-sports)',
  'arts-and-theatre': 'var(--color-cat-arts)',
  film: 'var(--color-cat-film)',
  family: 'var(--color-cat-family)',
  other: 'var(--color-cat-other)',
}

export const CATEGORY_TINT: Record<EventCategory, string> = {
  music: 'var(--color-cat-music-tint)',
  sports: 'var(--color-cat-sports-tint)',
  'arts-and-theatre': 'var(--color-cat-arts-tint)',
  film: 'var(--color-cat-film-tint)',
  family: 'var(--color-cat-family-tint)',
  other: 'var(--color-cat-other-tint)',
}
