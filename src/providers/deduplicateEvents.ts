import type { Coordinates, Event } from '../domain/events/event'

/**
 * Cross-provider duplicate detection for `searchEvents`'s combined results
 * (e.g. the same real concert returned by both Ticketmaster and JamBase).
 * Deliberately conservative — the cost of missing a real duplicate is much
 * lower than the cost of silently merging two genuinely different events
 * (two different rooms/acts at the same venue and time, which does happen).
 *
 * A pair counts as a duplicate only when ALL of:
 *   1. exact same `start.utc`, and both have a known time (`timeKnown`) —
 *      there's no reliable instant to compare otherwise;
 *   2. venues within `DISTANCE_THRESHOLD_METERS` of each other;
 *   3. their names share enough *non-venue* vocabulary (see
 *      `namesLikelyMatch`) — this is what actually distinguishes "the same
 *      show, described differently by two providers" from "two different
 *      shows that happen to be in the same building at the same hour".
 */

const DISTANCE_THRESHOLD_METERS = 150

/** Generic words that appear across unrelated event names/venues and carry
 * no identifying signal on their own. */
const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'at',
  'in',
  'on',
  'and',
  'or',
  'of',
  'to',
  'with',
  'live',
  'tour',
  'show',
  'presents',
  'present',
  'ft',
  'feat',
  'featuring',
  'sala',
  'club',
  'venue',
])

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics (é -> e, ó -> o, ...)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokenize(text: string): string[] {
  const normalized = normalize(text)
  return normalized.length > 0 ? normalized.split(' ') : []
}

/** The event name's tokens, minus generic stopwords and anything that's
 * just echoing the venue's own name — a duplicate check should compare
 * "what's happening", not "where", since location is already a separate
 * criterion. */
function significantNameTokens(name: string, venueName: string): Set<string> {
  const venueTokens = new Set(tokenize(venueName))
  return new Set(tokenize(name).filter((token) => !STOPWORDS.has(token) && !venueTokens.has(token)))
}

/**
 * True when enough of the non-venue vocabulary overlaps to call these the
 * same event. Requires 2+ shared significant tokens, or exactly 1 when
 * that's *all* the signal either side has (a single-word artist name
 * shouldn't need a second token to agree on).
 */
export function namesLikelyMatch(nameA: string, venueNameA: string, nameB: string, venueNameB: string): boolean {
  const tokensA = significantNameTokens(nameA, venueNameA)
  const tokensB = significantNameTokens(nameB, venueNameB)
  if (tokensA.size === 0 || tokensB.size === 0) return false

  let shared = 0
  for (const token of tokensA) {
    if (tokensB.has(token)) shared += 1
  }

  if (shared >= 2) return true
  return shared >= 1 && Math.min(tokensA.size, tokensB.size) === 1
}

function haversineDistanceMeters(a: Coordinates, b: Coordinates): number {
  const EARTH_RADIUS_METERS = 6371000
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180

  const dLat = toRadians(b.latitude - a.latitude)
  const dLon = toRadians(b.longitude - a.longitude)
  const lat1 = toRadians(a.latitude)
  const lat2 = toRadians(b.latitude)

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h))
}

function areDuplicates(a: Event, b: Event): boolean {
  if (!a.start.timeKnown || !b.start.timeKnown) return false
  if (a.start.utc !== b.start.utc) return false
  if (haversineDistanceMeters(a.venue.coordinates, b.venue.coordinates) > DISTANCE_THRESHOLD_METERS) return false
  return namesLikelyMatch(a.name, a.venue.name, b.name, b.venue.name)
}

/** Higher is "richer" — image counts double since the UI leans on it
 * heavily (featured hero, listing thumbnails); the rest are equally minor. */
function dataRichnessScore(event: Event): number {
  let score = 0
  if (event.image) score += 2
  if (event.priceRange) score += 1
  if (event.end) score += 1
  if (event.venue.address) score += 1
  if (event.venue.city) score += 1
  return score
}

/** Ties keep whichever was already kept (first-seen) — deterministic and
 * stable without hardcoding a "prefer this provider" rule. */
function pickRicherEvent(existing: Event, candidate: Event): Event {
  return dataRichnessScore(candidate) > dataRichnessScore(existing) ? candidate : existing
}

/** O(n²) over the combined result set — fine at this scale (tens of
 * events per search), and simpler than a spatial/temporal index. */
export function deduplicateEvents(events: Event[]): Event[] {
  const kept: Event[] = []
  for (const event of events) {
    const duplicateIndex = kept.findIndex((existing) => areDuplicates(existing, event))
    if (duplicateIndex === -1) {
      kept.push(event)
    } else {
      kept[duplicateIndex] = pickRicherEvent(kept[duplicateIndex], event)
    }
  }
  return kept
}
