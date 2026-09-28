import { describe, expect, it } from 'vitest'
import type { SearchUrlState } from './searchUrlState'
import { toEventSearchParams } from './toEventSearchParams'

const REFERENCE_TIME = '2026-09-19T13:00:00Z'

function state(overrides: Partial<SearchUrlState> = {}): SearchUrlState {
  return { timeMode: 'today', citySlug: 'barcelona', ...overrides }
}

describe('toEventSearchParams', () => {
  it('transforms a complete state into exactly the expected EventSearchParams shape', () => {
    const result = toEventSearchParams(
      state({ timeMode: 'weekend', categories: ['music', 'film'], citySlug: 'barcelona' }),
      REFERENCE_TIME,
    )

    expect(result).toEqual({
      timeMode: 'weekend',
      referenceTime: REFERENCE_TIME,
      location: { type: 'city', citySlug: 'barcelona' },
      categories: ['music', 'film'],
    })
  })

  it('preserves referenceTime exactly as given', () => {
    const result = toEventSearchParams(state(), '2027-01-01T00:00:00.000Z')

    expect(result?.referenceTime).toBe('2027-01-01T00:00:00.000Z')
  })

  it('preserves categories exactly, without reordering, deduping, or filtering', () => {
    // Deliberately non-canonical order — canonicalization is searchUrlState's
    // job, not this function's; constructing SearchUrlState directly here
    // (bypassing the parser) proves this function doesn't redo that work.
    const result = toEventSearchParams(state({ categories: ['film', 'music', 'music'] }), REFERENCE_TIME)

    expect(result?.categories).toEqual(['film', 'music', 'music'])
  })

  it('leaves categories undefined when the state has no filter', () => {
    const result = toEventSearchParams(state({ categories: undefined }), REFERENCE_TIME)

    expect(result?.categories).toBeUndefined()
  })

  it('converts citySlug into a city EventLocation', () => {
    const result = toEventSearchParams(state({ citySlug: 'barcelona' }), REFERENCE_TIME)

    expect(result?.location).toEqual({ type: 'city', citySlug: 'barcelona' })
  })

  it('transforms timeMode "tonight" like any other mode, now that EventSearchParams represents it natively', () => {
    const result = toEventSearchParams(state({ timeMode: 'tonight' }), REFERENCE_TIME)

    expect(result?.timeMode).toBe('tonight')
  })

  it('resolves a known citySlug via the shared city config', () => {
    const result = toEventSearchParams(state({ citySlug: 'barcelona' }), REFERENCE_TIME)

    expect(result?.location).toEqual({ type: 'city', citySlug: 'barcelona' })
  })

  it('returns null when citySlug is absent, since EventSearchParams.location has no "unspecified" variant', () => {
    // No shared default-city policy exists (see domain/cities.ts) for this
    // function to fall back to — it deliberately does not invent one, and
    // reports "not representable" instead of fabricating a location.
    const result = toEventSearchParams(state({ citySlug: undefined }), REFERENCE_TIME)

    expect(result).toBeNull()
  })

  it('returns null for a citySlug with no entry in the shared city config, without inventing a fallback', () => {
    const result = toEventSearchParams(state({ citySlug: 'atlantis' }), REFERENCE_TIME)

    expect(result).toBeNull()
  })
})
