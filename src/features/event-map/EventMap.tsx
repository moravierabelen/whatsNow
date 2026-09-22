import { useMemo } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import 'leaflet/dist/leaflet.css'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css'
import type { Coordinates, Event } from '../../domain/events/event'
import { env } from '../../lib/env'
import { CARTO_ATTRIBUTION, cartoTileUrl } from './cartoTiles'
import './leafletDefaultIcon'

const DEFAULT_ZOOM = 13

// Barcelona — this MVP's only supported city, used only as the last-resort
// map center when there are no events and the caller didn't pass its own
// `defaultCenter`. EventMap itself has no city knowledge beyond this
// fallback; a caller targeting a different city should pass `defaultCenter`.
const FALLBACK_CENTER: Coordinates = { latitude: 41.3851, longitude: 2.1734 }

export interface EventMapProps {
  events: Event[]
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
 * Self-contained event map: one marker per event (clustered), CARTO tiles.
 * Not yet wired to map/list sync, URL state, or a real event detail
 * experience — the popup is only enough to identify which event a marker
 * represents.
 *
 * `MapContainer`'s `center`/`zoom` are only the *initial* view in React
 * Leaflet — they don't re-center the map on later prop changes. Recentering
 * when `events` changes is left for the future map/list-sync integration.
 *
 * The map fills its container (`height: 100%`/`width: 100%`); the parent
 * must give that container an explicit height, or Leaflet renders a
 * zero-height map — a well-known Leaflet integration gotcha, not a bug here.
 */
export function EventMap({ events, defaultCenter }: EventMapProps) {
  const center = useMemo(() => {
    if (events.length === 0) {
      return defaultCenter ?? FALLBACK_CENTER
    }
    return centroid(events.map((event) => event.venue.coordinates))
  }, [events, defaultCenter])

  return (
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
          >
            <Popup>{event.name}</Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  )
}
