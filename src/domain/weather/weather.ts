export type WeatherCondition = 'clear' | 'partly-cloudy' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm'

export interface Weather {
  temperatureC: number
  condition: WeatherCondition
  /** Same `{utc, timeZone}` shape as `EventStart`/`EventEnd` — a real UTC
   * instant plus the zone needed to display it meaningfully (Open-Meteo's
   * own sunrise/sunset values come back as naive local datetimes). */
  sunrise: { utc: string; timeZone: string }
  sunset: { utc: string; timeZone: string }
}
