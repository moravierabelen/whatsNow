# whatsNow

> Find something worth doing right now.

whatsNow is a map-first event discovery app for finding things to do in the city, whether they're happening right now, tonight, later today, tomorrow, or this weekend.

The goal is simple: reduce the friction between **"I want to do something"** and **"here's somewhere worth going."**

Barcelona is the first supported city, but the application is designed to be city-agnostic.

<!-- TODO: add a screenshot (or short GIF) of the discovery view here — it is the first thing a reader looks for. -->
<!-- TODO: add the live demo link here once the app is deployed. -->

## Features

- Discover events by time: Now, Tonight, Today, Tomorrow and Weekend
- Browse events on a clustered map or in a list
- Filter by category
- Highlight events happening now and starting soon
- Handle events with known and unknown start times
- Support multi-day events
- Combine data from multiple event providers
- Deduplicate the same event across providers
- Shareable navigation state through the URL
- Weather context for the current city
- Responsive desktop and mobile experience

## How it works

whatsNow combines events from external providers and normalizes them into a common internal event model.

The application then applies its own temporal logic to determine which events are relevant for the selected time mode.

```text
Event providers
      ↓
Provider adapters
      ↓
Internal event model
      ↓
Deduplication
      ↓
Temporal classification
      ↓
Discovery UI
      ├── Map
      └── List
```

The UI and domain logic do not depend directly on provider-specific response formats.

## Providers

The current MVP uses:

| Provider                                                      | Used for        | API key    |
| ------------------------------------------------------------- | --------------- | ---------- |
| [Ticketmaster Discovery](https://developer.ticketmaster.com/) | Events          | Required   |
| [JamBase](https://developer.jambase.com/)                     | Events          | Required   |
| [Open-Meteo](https://open-meteo.com/)                         | Weather context | Not needed |
| [CARTO](https://carto.com/)                                   | Map tiles       | Required   |

Each event provider is isolated behind a small provider interface. This keeps provider-specific API details out of the application domain and makes it possible to add other sources later.

## Temporal model

Time is one of the core parts of whatsNow. All temporal calculations use the event's own venue timezone rather than relying on the browser's local timezone.

| Mode         | Window                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| **Now**      | The current instant, split into _Happening now_, _Starting soon_ (the next 180 minutes) and _Later today_ |
| **Tonight**  | The current or next night block: 18:00 through 06:00 the following morning                                |
| **Today**    | The current local calendar day                                                                            |
| **Tomorrow** | The following local day                                                                                   |
| **Weekend**  | Friday 18:00 through the end of Sunday                                                                    |

Events without a known start time are kept in the discovery experience, but are excluded from anything that requires a precise instant: they never appear as "happening now" or "starting soon", are never chosen as the featured event, and are not placed on the map. They are shown with an explicit `Time TBA`, never an invented hour, and when such an event spans several calendar days, it is shown as a date range (`Fri–Sat`) instead.

## Deduplication

The same real-world event often appears in more than one provider, for example `only the poets - AND I'D DO IT AGAIN` from Ticketmaster and `Only The Poets at Razzmatazz 3` from JamBase.

Matching on start time and location alone is not enough. A venue complex like Razzmatazz has several rooms at nearly identical coordinates running different shows at the same time, and collapsing those would hide real events.

So two events are treated as the same one only when all three hold:

- an identical known start instant
- venue coordinates within 150 m of each other
- overlapping significant name tokens: after normalizing case and diacritics and dropping stopwords, tokens that also appear in the venue name are removed, so `at Razzmatazz 3` can never itself be the evidence that two different shows are the same event

When a duplicate is confirmed, the record carrying more usable detail is kept (image, price range, end time, address, city), with a stable tiebreak. Fields are deliberately not merged across providers.

## Architecture

The project is built with:

- [React](https://react.dev/) and [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [TanStack Query](https://tanstack.com/query) for server state
- [React Router](https://reactrouter.com/) for URL-driven navigation state
- [Leaflet](https://leafletjs.com/), via `react-leaflet` and `react-leaflet-cluster` for marker clustering
- [date-fns](https://date-fns.org/) and `@date-fns/tz` for timezone-aware time handling
- [Phosphor Icons](https://phosphoricons.com/)
- [Vitest](https://vitest.dev/) and Testing Library

The codebase follows a feature-oriented structure with a clear separation between:

- domain models and business logic
- provider integrations
- application state
- UI components

Server state is handled with TanStack Query. Local UI state remains local to the relevant components, while shareable navigation and filtering state lives in the URL.

## Running locally

Requires **Node.js 20.19+ or 22.12+** (Vite's own requirement) and **pnpm** — the repo pins `pnpm@11.17.0` and only commits a `pnpm-lock.yaml`.

```bash
pnpm install
cp .env.example .env   # then fill in the keys below
pnpm dev
```

Then open the local URL shown by Vite.

### Environment variables

```env
VITE_TICKETMASTER_API_KEY=
VITE_JAMBASE_API_KEY=
VITE_CARTO_API_KEY=
```

All three are required: without the CARTO key the map renders no tiles, and each event provider needs its own key. Open-Meteo needs no credentials.

> **Note on keys:** this is a client-only application, so anything prefixed `VITE_` is inlined into the production bundle at build time and is therefore public. That is an accepted trade-off for the current MVP, where all three services are free-tier and the keys are rotatable. Moving provider calls behind a thin server-side proxy is the fix, and is listed under [What's next](#whats-next).

## Validation

The project includes unit and integration tests covering domain logic, provider mapping, temporal behavior, and UI behavior.

```bash
pnpm test        # vitest
pnpm lint        # eslint
pnpm typecheck   # tsc -b
pnpm build       # tsc -b && vite build
```

## Project status

whatsNow is currently an MVP.

The current focus is on making the discovery experience reliable and useful with real event data. The project deliberately avoids adding features such as accounts, personalization, social features, or a backend database until there is a clear product reason for them.

One piece of MVP scope is still in progress: **complete pagination and large-result handling**. The app currently surfaces only the first page of results from each provider, and the MVP should expose every available event rather than stopping there.

## What's next

Some areas intentionally left for later iterations:

- Shareable event experiences / event detail pages
- Map/list synchronization
- Further mobile map interactions
- Server-side provider proxying
- Additional cities
- Additional event providers

## Why this project exists

Most event platforms start from the question:

> "What event are you looking for?"

whatsNow starts somewhere else:

> "What can I do right now?"

It is an exploration of whether a simpler, more contextual interface can make spontaneous city discovery easier.

## License

See [LICENSE](LICENSE).
