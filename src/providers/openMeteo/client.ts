const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'

export class OpenMeteoRequestError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'OpenMeteoRequestError'
    this.status = status
  }
}

/** Open-Meteo is keyless — no API key/auth to attach, unlike Ticketmaster/JamBase. */
export async function fetchOpenMeteoForecast(latitude: number, longitude: number, timeZone: string): Promise<unknown> {
  const url = new URL(FORECAST_URL)
  url.searchParams.set('latitude', String(latitude))
  url.searchParams.set('longitude', String(longitude))
  url.searchParams.set('current', 'temperature_2m,weather_code')
  url.searchParams.set('daily', 'sunrise,sunset')
  // Only today's sunrise/sunset — Open-Meteo defaults to a 7-day forecast otherwise.
  url.searchParams.set('forecast_days', '1')
  url.searchParams.set('timezone', timeZone)

  const response = await fetch(url)
  if (!response.ok) {
    throw new OpenMeteoRequestError(`Open-Meteo request failed with status ${response.status}`, response.status)
  }

  return response.json()
}
