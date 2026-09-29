import { useMemo, useState } from 'react'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import 'leaflet/dist/leaflet.css'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css'
import type { Coordinates, Event } from '../../domain/events/event'
import { env } from '../../lib/env'
import { CARTO_ATTRIBUTION, cartoTileUrl } from './cartoTiles'
import './leafletDefaultIcon'
import { MarkerPreviewCard } from './MarkerPreviewCard'

const DEFAULT_ZOOM = 13

// Barcelona — this MVP's only supported city, used only as the last-resort
// map center when there are no events and the caller didn't pass its own
// `defaultCenter`. EventMap itself has no city knowledge beyond this
// fallback; a caller targeting a different city should pass `defaultCenter`.
const FALLBACK_CENTER: Coordinates = { latitude: 41.3851, longitude: 2.1734 }

export interface EventMapProps {
  events: Event[]
  /** Needed to format the marker preview card's date/time — explicit, same rule as the rest of the app (see `temporal.ts`). */
  referenceTime: string
  defaultCenter?: Coordinates
}

/** Simple average of event venue coordinates — not a viewport fit, just a reasonable initial center. */
function centroid(coordinates: Coordinates[]): Coordinates {
  const total = coordinates.reduce(
    (sum, coordinate) => ({
      latitude: sum.latitude + coordinate.latitude,
      longitude: sum.longitude + coordinate.longitude,
    }),
    { latitude: 0, longitude: 0 },
  )
  return { latitude: total.latitude / coordinates.length, longitude: total.longitude / coordinates.length }
}

/**
 * The parent must give this an explicit height or Leaflet renders nothing.
 * `center`/`zoom` are the initial view only; they do not re-center on prop changes.
 */
export function EventMap({ events, referenceTime, defaultCenter }: EventMapProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null

  const center = useMemo(() => {
    if (events.length === 0) {
      return defaultCenter ?? FALLBACK_CENTER
    }
    return centroid(events.map((event) => event.venue.coordinates))
  }, [events, defaultCenter])

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[center.latitude, center.longitude]}
        zoom={DEFAULT_ZOOM}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer attribution={CARTO_ATTRIBUTION} url={cartoTileUrl(env.CARTO_API_KEY)} />
        <MarkerClusterGroup>
          {events.map((event) => (
            <Marker
              key={event.id}
              position={[event.venue.coordinates.latitude, event.venue.coordinates.longitude]}
              title={event.name}
              alt={event.name}
              eventHandlers={{
                click: () => setSelectedEventId((current) => (current === event.id ? null : event.id)),
              }}
            />
          ))}
        </MarkerClusterGroup>
      </MapContainer>
      <MarkerPreviewCard
        event={selectedEvent}
        referenceTime={referenceTime}
        onClose={() => setSelectedEventId(null)}
      />
    </div>
  )
}
