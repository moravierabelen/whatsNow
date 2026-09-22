import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

/**
 * Bundlers (Vite included) don't resolve Leaflet's default marker icon URLs
 * correctly out of the box — this is Leaflet's own documented workaround:
 * re-point the default icon at the bundler-resolved image imports.
 * `_getIconUrl` isn't part of the public Icon.Default type, hence the cast.
 *
 * Side-effecting on import by design (mirrors how the map spike validated
 * it) — import this module once, anywhere a Leaflet map is rendered.
 */
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})
