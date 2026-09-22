/**
 * CARTO Voyager — chosen after manual review, Positron looked too
 * washed-out. Not a final product decision — still easy to swap (same
 * account/key, just a different CARTO style path).
 */
const CARTO_STYLE = 'rastertiles/voyager'

export const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'

export function cartoTileUrl(apiKey: string | undefined): string {
  return `https://{s}.basemaps.cartocdn.com/${CARTO_STYLE}/{z}/{x}/{y}.png?key=${apiKey}`
}
