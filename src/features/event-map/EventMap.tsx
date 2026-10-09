import { useState } from 'react'
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

export interface EventMapProps {
  events: Event[]
  /** Needed to format the marker preview card's date/time — explicit, same rule as the rest of the app (see `temporal.ts`). */
  referenceTime: string
  /**
   * The city being searched. Fixed rather than derived from the events: an
   * average drifts with a single far-off venue, and jumps on every filter
   * change, while the reader expects the map of the city they asked for.
   */
  center: Coordinates
}

/**
 * The parent must give this an explicit height or Leaflet renders nothing.
 * `center`/`zoom` are the initial view only; they do not re-center on prop changes.
 */
export function EventMap({ events, referenceTime, center }: EventMapProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null

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
