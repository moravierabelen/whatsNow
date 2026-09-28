import { describe, expect, it } from 'vitest'
import { parseSearchUrlState, serializeSearchUrlState } from './searchUrlState'
import type { SearchUrlState } from './searchUrlState'

function search(query: string): URLSearchParams {
  return new URLSearchParams(query)
}

describe('parseSearchUrlState — mode', () => {
  it.each(['now', 'tonight', 'today', 'tomorrow', 'weekend'])('accepts a valid mode: %s', (mode) => {
    expect(parseSearchUrlState(search(`mode=${mode}`)).timeMode).toBe(mode)
  })

  it('defaults to now when mode is absent', () => {
    expect(parseSearchUrlState(search('')).timeMode).toBe('now')
  })

  it('defaults to now when mode is invalid', () => {
    expect(parseSearchUrlState(search('mode=yesterday')).timeMode).toBe('now')
  })
})

describe('parseSearchUrlState — category', () => {
  it('parses a single category', () => {
    expect(parseSearchUrlState(search('category=music')).categories).toEqual(['music'])
  })

  it('parses multiple categories in canonical order regardless of input order', () => {
    expect(parseSearchUrlState(search('category=film,music')).categories).toEqual(['music', 'film'])
  })

  it('ignores unknown categories', () => {
    expect(parseSearchUrlState(search('category=music,unknown')).categories).toEqual(['music'])
  })

  it('removes duplicate categories', () => {
    expect(parseSearchUrlState(search('category=music,music,film')).categories).toEqual(['music', 'film'])
  })

  it('treats an entirely-unknown category list as no filter', () => {
    expect(parseSearchUrlState(search('category=unknown,alsoUnknown')).categories).toBeUndefined()
  })

  it('treats an absent category param as no filter', () => {
    expect(parseSearchUrlState(search('')).categories).toBeUndefined()
  })

  it('treats an empty category param as no filter', () => {
    expect(parseSearchUrlState(search('category=')).categories).toBeUndefined()
  })

  it('trims stray whitespace around category values', () => {
    expect(parseSearchUrlState(search('category=music,%20film')).categories).toEqual(['music', 'film'])
  })
})

describe('parseSearchUrlState — city', () => {
  it('uses the given citySlug as-is', () => {
    expect(parseSearchUrlState(search('city=barcelona')).citySlug).toBe('barcelona')
  })

  it('is undefined when city is absent', () => {
    expect(parseSearchUrlState(search('')).citySlug).toBeUndefined()
  })

  it('is undefined when city is an empty string', () => {
    expect(parseSearchUrlState(search('city=')).citySlug).toBeUndefined()
  })
})

describe('parseSearchUrlState — unrelated params', () => {
  it('ignores query params it does not recognize', () => {
    const state = parseSearchUrlState(search('foo=bar&mode=today&unrelated=1'))

    expect(state.timeMode).toBe('today')
    expect(state).not.toHaveProperty('foo')
    expect(state).not.toHaveProperty('unrelated')
  })
})

describe('serializeSearchUrlState', () => {
  const baseState: SearchUrlState = { timeMode: 'now' }

  it('omits mode when it is the default (now)', () => {
    expect(serializeSearchUrlState(baseState).has('mode')).toBe(false)
  })

  it('includes mode when it is not the default', () => {
    expect(serializeSearchUrlState({ ...baseState, timeMode: 'weekend' }).get('mode')).toBe('weekend')
  })

  it('omits category when categories are absent', () => {
    expect(serializeSearchUrlState(baseState).has('category')).toBe(false)
  })

  it('serializes categories in canonical order regardless of input order', () => {
    expect(serializeSearchUrlState({ ...baseState, categories: ['film', 'music'] }).get('category')).toBe(
      'music,film',
    )
  })

  it('omits city when absent', () => {
    expect(serializeSearchUrlState(baseState).has('city')).toBe(false)
  })

  it('includes city when present', () => {
    expect(serializeSearchUrlState({ ...baseState, citySlug: 'barcelona' }).get('city')).toBe('barcelona')
  })
})

describe('round-trip: parse(serialize(state)) === state', () => {
  const cases: SearchUrlState[] = [
    { timeMode: 'now' },
    { timeMode: 'tonight' },
    { timeMode: 'weekend', categories: ['music', 'film'], citySlug: 'barcelona' },
    { timeMode: 'today', categories: ['other'] },
  ]

  it.each(cases)('round-trips %j', (state) => {
    const roundTripped = parseSearchUrlState(serializeSearchUrlState(state))
    expect(roundTripped).toEqual(state)
  })

  it('produces the same parsed state for URLs differing only in category order/duplicates/unknowns', () => {
    const a = parseSearchUrlState(search('category=music,film'))
    const b = parseSearchUrlState(search('category=film,music,music,bogus'))

    expect(a).toEqual(b)
  })

  it('produces the same parsed state whether serialized from either category order', () => {
    const fromA = serializeSearchUrlState({ timeMode: 'now', categories: ['music', 'film'] })
    const fromB = serializeSearchUrlState({ timeMode: 'now', categories: ['film', 'music'] })

    expect(fromA.toString()).toBe(fromB.toString())
  })
})
