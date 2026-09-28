# Product Specification

## Product concept

A location-based discovery app designed to help users answer:

> What can I do right now?

The product is designed around immediate decision-making rather than
long-term event planning.

Time and location are first-class dimensions of the experience.

## Core experience

The application is map-first.

Users discover events through:

- an interactive map
- a synchronized event list
- event previews
- event detail pages

The map is not an alternative representation of the list. It is a
primary part of the discovery experience.

## Time modes

The primary time modes are:

- Now
- Today
- Tomorrow
- Weekend

### Now

The default experience.

Results are organized into:

1. Happening now
2. Starting soon
3. Later today

"Starting soon" represents events beginning within a short configurable
window, initially around 2–3 hours.

If nothing is happening at the current moment, the application should
surface upcoming events rather than displaying a generic empty state.

## Location

The product is geographically agnostic.

The MVP starts with a single geographic area as a controlled initial
scope.

Browser geolocation is not required for the initial experience.

A future "Near me" experience will allow users to explicitly share
their location and discover events around their current position.

## Event discovery

Events are represented on the map using category-specific markers.

When multiple events overlap spatially, markers may be clustered.

Selecting an event from the map or list should keep the map and list
synchronized.

Users can open an event preview and navigate to a dedicated event
details page.

## Discovery and filters

Discovery is driven by time mode, category, location, and the map/list
themselves, rather than by a free-text query.

The MVP includes:

- category filters
- date/time filters

Free-text search for a known event, artist, or venue may be considered
in a future iteration, but is not part of the MVP.

Filter state should be represented in the URL where appropriate so
that results can be shared and preserved across navigation.

## Event data

Ticketmaster Discovery API is the initial event provider.

External provider responses must be normalized into an internal domain
model before reaching the UI.

Events without usable geographic coordinates are excluded from the MVP.

Other incomplete fields, such as images or descriptions, should not
prevent an event from being displayed.

The domain model should not depend directly on Ticketmaster's response
format.

## MVP scope

The sections above describe the product being aimed at. The two lists
below are the phasing for its first cut, so a capability can belong to
the product and still be deferred here — map/list synchronization and
event detail pages both are.

- Map
- Event markers
- Event list
- Basic filters
- URL-synchronized filters
- External event/ticket link
- Multiple event providers with cross-provider deduplication
- Loading states
- Error states and retry
- Empty states
- Responsive experience
- Tests for important behavior

## Out of scope for MVP

- Browser geolocation
- Distance-based discovery
- User accounts
- Backend
- Database
- Persistent favorites
- Notifications
- Calendar integration
- Marker/list synchronization
- Dedicated event detail pages
- A deliberate accessibility pass

The architecture should not prevent these capabilities from being
introduced later, but they should not drive unnecessary MVP complexity.

## Product principles

1. Map-first discovery
2. Solve the immediate "what can I do?" problem
3. Time and location are first-class concepts
4. Fast, simple interaction
5. Useful empty/loading/error states
6. Responsive and accessible UX
7. Pragmatic architecture
8. Avoid unnecessary complexity

### Event eligibility

For the MVP, an event must have:

- a usable start date/time;
- a physical venue with usable coordinates;
- an external event URL.

Events representing flexible-admission or timed-entry inventory
(e.g. listings with Ticketmaster `dates.access`) are excluded from
the MVP event model.

Events with missing end times remain valid events, but cannot be
classified as "Happening now" solely from their start time.
