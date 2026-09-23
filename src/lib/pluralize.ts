const PLURAL_RULES = new Intl.PluralRules('en-US')

/**
 * English pluralization via the built-in `Intl.PluralRules` API — the same
 * mechanism i18n libraries use under the hood, not a hand-rolled `=== 1`
 * check. `pluralize(1, 'plan')` -> `'plan'`, `pluralize(2, 'plan')` ->
 * `'plans'`, `pluralize(1, 'city', 'cities')` -> `'city'`.
 */
export function pluralize(count: number, singular: string, plural: string = `${singular}s`): string {
  return PLURAL_RULES.select(count) === 'one' ? singular : plural
}
