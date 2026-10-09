# MEMORY.md — whatsnow

Internal working memory. `README.md` is the public-facing status; this is the working one.
Keep it under ~50 lines: summarize or delete what no longer earns its place.

## Current state

- MVP deployed, client-only, no backend. Barcelona is the only city. Live providers:
  Ticketmaster, JamBase and Agenda Cultural de Catalunya.
- Two kinds of plan, not one: timed (`start.timeKnown`) and open-to-visit runs with
  `openingHours`. The listing splits on that (`eventSelection.splitByTiming`) and so does
  the formatting. `searchEvents` enforces the city radius and the category for every
  provider; the map centres on the city and shows everything the listing shows.
- `HappeningNowRail` and `HappeningNowCard` are unused but not deleted — pending a product
  decision, not dead code.

## Decisions (and why)

- The Tonight time mode is dropped; the modes are Now, Today, Tomorrow and Weekend.
  Decided but not yet implemented: it is still live in `TimeMode`, `temporal.ts`,
  `TimeNav`, `searchUrlState` and the README's mode table.
- Event detail pages are dropped — not deferred, not being built. Note that `url` is
  optional on `Event`, so some plans have no page of their own anywhere.
- Second city: Madrid, with `datos.madrid.es` (Agenda de actividades) as its local
  provider — the municipal equivalent of what Agenda Cat is for Barcelona.
- `VITE_` keys are public in the bundle. Accepted while all three services are free-tier
  and rotatable; server-side proxying is the fix, not an emergency.
- No cancellation guard for Ticketmaster: 995 Spanish events over six months returned only
  `onsale`/`offsale`, so the cancelled code's spelling is unverified. A guess would be a
  silent no-op that reads like protection.

## Mistakes to avoid

- Agenda Cat has no status field and no structured hours: everything arrives as free text
  and has to be inferred. See the comments in `cancelled.ts` and `horari.ts`.
- JamBase did have an `eventStatus` field and we ignored it for months, inferring from
  nothing. Check a provider's own fields before parsing text or assuming they are absent.
- Agenda Cat names carry undecoded HTML entities (`Roig &amp; Cassanyes`, `&nbsp;`) and we
  render them literally. Not yet fixed.

## Next steps

- Remove the Tonight mode from the code, its tests and the README's mode table, and make
  Today start from now. Trap: weekly showtimes inside a run have no end time, so a 20:00
  show would vanish at 20:01 — apply the parsed `durationMinutes` to them first.
- Open product questions: the `At a set time`/`Open to visit` section headings, whether to
  delete `HappeningNowRail`/`HappeningNowCard`, and whether the featured card's
  `View tickets` should read `More info` now that URLs go to a site's home.
- Madrid as the second city, with the `datos.madrid.es` provider.
- Map ↔ list synchronization; further mobile map interactions.
- Accessibility pass (keyboard navigation, focus states, announced results).
- Server-side provider proxying.
