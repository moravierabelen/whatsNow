import { ArrowDownIcon } from '@phosphor-icons/react'
import type { EventCategory } from '../../domain/events/event'
import type { TimeMode } from '../../domain/events/provider'
import { pluralize } from '../../lib/pluralize'
import { EventMap } from '../event-map/EventMap'
import { BrandHeader } from './BrandHeader'
import { CATEGORY_LABEL } from './categoryPresentation'
import { CategoryNav } from './CategoryNav'
import { EmptyState } from './EmptyState'
import { formatEventTime, isEventLiveNow } from './eventDisplay'
import { groupByNowBucket, selectFeaturedEvent, sortByStart } from './eventSelection'
import { EventListItem } from './EventListItem'
import { FeaturedEvent } from './FeaturedEvent'
import { LoadingRadar } from './LoadingRadar'
import { NowBucketedListing } from './NowBucketedListing'
import { TimeNav } from './TimeNav'
import { useEventSearchFromUrl } from './useEventSearchFromUrl'
import { useSetSearchUrlState } from './useSetSearchUrlState'

const MODE_HEADLINE: Record<TimeMode, { eyebrow: string; headline: string }> = {
  now: { eyebrow: 'Live in the city', headline: "What's happening right now" },
  tonight: { eyebrow: 'Tonight', headline: 'Plans for tonight' },
  today: { eyebrow: 'Today', headline: 'Plans worth making time for today' },
  tomorrow: { eyebrow: 'Tomorrow', headline: 'Get a head start on tomorrow' },
  weekend: { eyebrow: 'This weekend', headline: 'Make the most of your weekend' },
}

/**
 * The production discovery page — page composition for the established
 * `foundation` UI direction (header, temporal/category nav, featured
 * event + map, secondary listing), wired to the real search pipeline
 * (URL -> useEventSearchFromUrl -> real Ticketmaster/JamBase results).
 *
 * Deliberately not yet included (see the task that introduced this file
 * for the full list): map/list selection sync, an in-app event detail
 * page, complex filtering, a mobile map toggle/sheet — events link out to
 * their real ticketing/info page instead.
 */
export function DiscoveryPage() {
  const { data, isPending, isError, fetchStatus, urlState } = useEventSearchFromUrl()
  const setSearchUrlState = useSetSearchUrlState()

  const category: EventCategory | 'all' = urlState.categories?.[0] ?? 'all'

  function handleModeChange(timeMode: TimeMode) {
    setSearchUrlState({ ...urlState, timeMode, page: 1 })
  }

  function handleCategoryChange(next: EventCategory | 'all') {
    setSearchUrlState({ ...urlState, categories: next === 'all' ? undefined : [next], page: 1 })
  }

  function clearFilters() {
    setSearchUrlState({ ...urlState, categories: undefined, page: 1 })
  }

  const header = (
    <header className="site-header">
      <BrandHeader citySlug={urlState.citySlug} />
      <div className="pb-4 lg:pb-5">
        <div className="mx-auto flex max-w-310 flex-col gap-3 px-6 lg:flex-row lg:items-center lg:px-8">
          <TimeNav mode={urlState.timeMode} onChange={handleModeChange} />
          <div className="min-w-0 flex-1 lg:border-l lg:border-border lg:pl-8">
            <CategoryNav category={category} onChange={handleCategoryChange} />
          </div>
        </div>
      </div>
    </header>
  )

  // Disabled query (no valid EventSearchParams yet, e.g. an unsupported
  // city) — not loading, not an error, just nothing to search for.
  if (fetchStatus === 'idle' && isPending) {
    return <div className="min-h-svh bg-paper">{header}</div>
  }

  if (isPending) {
    return (
      <div className="min-h-svh bg-paper">
        {header}
        <main className="mx-auto max-w-310 px-6 py-14 lg:px-8">
          <LoadingRadar />
        </main>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="min-h-svh bg-paper">
        {header}
        <main className="mx-auto max-w-310 px-6 py-14 lg:px-8">
          <p className="text-sm text-ink-muted">Could not load events.</p>
        </main>
      </div>
    )
  }

  const events = data.events
  const referenceTime = new Date().toISOString()
  const isNowMode = urlState.timeMode === 'now'

  // "Now" must never visually imply that later-today events are happening
  // now. `nowBuckets` (only computed in 'now' mode) drives whether the
  // hero shows the normal map+featured treatment, or the reduced,
  // no-markers/no-featured empty-state treatment described below.
  const nowBuckets = isNowMode ? groupByNowBucket(events, referenceTime) : null
  const showFeaturedHero =
    nowBuckets === null || nowBuckets.happeningNow.length + nowBuckets.startingSoon.length > 0
  const hasLaterToday = nowBuckets !== null && nowBuckets.laterToday.length > 0

  const featured = showFeaturedHero ? selectFeaturedEvent(events, referenceTime) : undefined
  // Only exclude the featured pick from the listing when it's actually
  // shown as featured — otherwise (reduced 'now' hero) it must still
  // surface via "More plans", or it disappears from the page entirely.
  const rest = sortByStart(featured ? events.filter(event => event.id !== featured.id) : events)
  const { eyebrow, headline } = MODE_HEADLINE[urlState.timeMode]

  return (
    <div className="min-h-svh bg-paper pb-24 lg:pb-20">
      {header}

      <main className="mx-auto max-w-310 px-6 pt-6 lg:px-8 lg:pt-8">
        <div className="mb-5 max-w-2xl lg:mb-6">
          <p className="eyebrow hero-anim-eyebrow mb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">
            {eyebrow}
          </p>
          <h1 className="hero-anim-heading font-display text-[28px] font-semibold leading-[1.08] tracking-tight text-ink sm:text-[36px]">
            {headline}
          </h1>
          {isNowMode && !showFeaturedHero ? (
            <div className="hero-anim-count mt-2 flex flex-col gap-1 text-sm text-ink-muted lg:flex-row">
              <p>Nothing happening right now.</p>
              <p>
                {hasLaterToday ? (
                  <a
                    href="#more-plans"
                    className="inline-flex items-center gap-1 text-ink-muted transition-colors hover:text-ink"
                  >
                    Explore what's coming up later today
                    <ArrowDownIcon className="h-3.5 w-3.5 shrink-0 text-accent" weight="bold" aria-hidden="true" />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleModeChange('tomorrow')}
                    className="cursor-pointer text-ink-muted transition-colors hover:text-ink"
                  >
                    See what's coming up tomorrow <span className="text-accent">→</span>
                  </button>
                )}
              </p>
            </div>
          ) : (
            <p className="hero-anim-count mt-2 text-sm text-ink-muted">
              <span className="font-mono">{events.length}</span> {pluralize(events.length, 'plan')}{' '}
              across the city
              {category !== 'all' ? ` in ${CATEGORY_LABEL[category]}` : ''}.
            </p>
          )}
        </div>

        {events.length === 0 && !isNowMode ? (
          <EmptyState onClearFilters={category !== 'all' ? clearFilters : undefined} />
        ) : (
          <div className="flex flex-col gap-14">
            {(isNowMode || featured) && (
              <section className="hero-anim-feature flex flex-col gap-3">
                {/* Map placement: paired with the featured event as one
                    hero block (not a persistent full-height sidebar) — the
                    mobile map/list arrangement stays intentionally open,
                    see DiscoveryPage's own doc comment. In 'now' mode with
                    nothing live/soon, the map still renders (full-width,
                    no markers) rather than disappearing — see showFeaturedHero. */}
                <div
                  className={`hero-grid grid grid-cols-1 gap-4 lg:h-110 lg:gap-0 ${featured ? 'lg:grid-cols-[3fr_2fr]' : ''}`}
                >
                  <div className="map-surface h-[50vh] w-full lg:h-full">
                    <EventMap events={showFeaturedHero ? events : []} />
                  </div>
                  {featured && (
                    <div className="hero-panel">
                      <FeaturedEvent
                        event={featured}
                        live={isEventLiveNow(featured, referenceTime)}
                        timeLabel={formatEventTime(featured, referenceTime)}
                      />
                    </div>
                  )}
                </div>
              </section>
            )}

            {rest.length > 0 && (
              <section id="more-plans">
                <h2 className="mb-4 text-lg font-semibold text-ink">More plans</h2>
                {isNowMode ? (
                  <NowBucketedListing events={rest} referenceTime={referenceTime} />
                ) : (
                  <ul className="listing-grid grid grid-cols-1 lg:grid-cols-2 lg:gap-x-12">
                    {rest.map(event => (
                      <EventListItem
                        key={event.id}
                        event={event}
                        live={isEventLiveNow(event, referenceTime)}
                        timeLabel={formatEventTime(event, referenceTime)}
                      />
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
