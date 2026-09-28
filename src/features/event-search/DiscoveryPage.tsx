import { ArrowDownIcon } from '@phosphor-icons/react'
import type { EventCategory } from '../../domain/events/event'
import type { TimeMode } from '../../domain/events/provider'
import { pluralize } from '../../lib/pluralize'
import { EventMap } from '../event-map/EventMap'
import { BrandHeader } from './BrandHeader'
import { CATEGORY_LABEL } from './categoryPresentation'
import { CategoryNav } from './CategoryNav'
import { EmptyState } from './EmptyState'
import { formatEventTime, formatWeekdayTime, isEventLiveNow } from './eventDisplay'
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
  tonight: { eyebrow: 'After dark', headline: 'Find somewhere worth going' },
  today: { eyebrow: 'Not too late', headline: 'Still time to make it count' },
  tomorrow: { eyebrow: 'Get ahead', headline: 'Find your next good plan' },
  weekend: { eyebrow: 'No plans yet?', headline: "Good. We've got a few ideas." },
}

export function DiscoveryPage() {
  const { data, isPending, isError, isFetching, refetch, fetchStatus, urlState } = useEventSearchFromUrl()
  const setSearchUrlState = useSetSearchUrlState()

  const category: EventCategory | 'all' = urlState.categories?.[0] ?? 'all'

  function handleModeChange(timeMode: TimeMode) {
    setSearchUrlState({ ...urlState, timeMode })
  }

  function handleCategoryChange(next: EventCategory | 'all') {
    setSearchUrlState({ ...urlState, categories: next === 'all' ? undefined : [next] })
  }

  function clearFilters() {
    setSearchUrlState({ ...urlState, categories: undefined })
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
          {/* Centered to match `LoadingRadar`, which this replaces once the
              automatic retries give up — the two states occupy the same
              spot, so left-aligning one of them makes the page jump. */}
          <div className="flex flex-col items-center justify-center gap-4 py-14">
            <p className="text-sm text-ink-muted">Could not load events.</p>
            {/* TanStack Query has already retried on its own by this point,
                so this is the explicit "try again now" the user is left
                with, rather than reloading the whole page. */}
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="cursor-pointer rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/90 disabled:cursor-default disabled:opacity-60"
            >
              {isFetching ? 'Retrying…' : 'Try again'}
            </button>
          </div>
        </main>
      </div>
    )
  }

  const events = data.events
  const referenceTime = new Date().toISOString()
  const isNowMode = urlState.timeMode === 'now'

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

  // Two different reasons a result can be short, with two different
  // remedies: a source that failed may well work on the next try, while a
  // truncated one needs a narrower search. Neither is worth naming the
  // provider over — that is our plumbing, not the user's problem.
  const incompleteResultsNotice =
    data.failedProviders.length > 0
      ? 'One of our sources is not responding, so some plans may be missing.'
      : data.truncated
        ? 'There are more plans than we can show here — try narrowing by category.'
        : undefined

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
                    <ArrowDownIcon
                      className="h-3.5 w-3.5 shrink-0 text-accent"
                      weight="bold"
                      aria-hidden="true"
                    />
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
          {/* Sits outside the branch above so it also shows alongside an
              empty result — "nothing found" and "a source went down" look
              identical otherwise, and only one of them is the city's fault. */}
          {incompleteResultsNotice && (
            <p className="hero-anim-count mt-1 text-xs text-ink-faint">{incompleteResultsNotice}</p>
          )}
        </div>

        {events.length === 0 && !isNowMode ? (
          <EmptyState onClearFilters={category !== 'all' ? clearFilters : undefined} />
        ) : (
          <div className="flex flex-col gap-14">
            {(isNowMode || featured) && (
              <section className="hero-anim-feature flex flex-col gap-3">
                <div
                  className={`hero-grid grid grid-cols-1 gap-4 lg:h-110 lg:gap-0 ${featured ? 'lg:grid-cols-[3fr_2fr]' : ''}`}
                >
                  <div className="map-surface h-[50vh] w-full lg:h-full">
                    <EventMap
                      events={showFeaturedHero ? events.filter(event => event.start.timeKnown) : []}
                      referenceTime={referenceTime}
                    />
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
                        timeLabel={
                          urlState.timeMode === 'weekend'
                            ? formatWeekdayTime(event)
                            : formatEventTime(event, referenceTime)
                        }
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
