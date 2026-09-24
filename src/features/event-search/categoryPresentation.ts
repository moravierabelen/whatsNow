import {
  CompassIcon,
  GuitarIcon,
  MaskHappyIcon,
  PersonSimpleTaiChiIcon,
  PopcornIcon,
  PuzzlePieceIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react'
import type { EventCategory } from '../../domain/events/event'

/**
 * Category colors/labels, ported from the foundation UI exploration's
 * `@theme` tokens.
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

/**
 * Category nav icons — Phosphor, presentation-only (not used by
 * `EventThumbnail`'s fallback or anywhere in the domain). `MasksTheaterIcon`
 * doesn't exist in the installed Phosphor version; `MaskHappyIcon` is the
 * confirmed substitute for `arts-and-theatre`.
 */
export const CATEGORY_ICON: Record<EventCategory, typeof CompassIcon> = {
  music: GuitarIcon,
  sports: PersonSimpleTaiChiIcon,
  'arts-and-theatre': MaskHappyIcon,
  film: PopcornIcon,
  family: UsersThreeIcon,
  other: PuzzlePieceIcon,
}

/** Not an `EventCategory` — `CategoryNav`'s "All" tab needs an icon too. */
export const ALL_CATEGORY_ICON = CompassIcon
