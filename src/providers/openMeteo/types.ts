/** Only the fields we actually request — see client.ts's `current`/`daily` params. */
export interface OpenMeteoCurrent {
  temperature_2m: number
  weather_code: number
}

export interface OpenMeteoDaily {
  /** Naive local datetimes (no UTC offset), one per requested forecast day
   * — we only request `forecast_days=1`, so index 0 is today. */
  sunrise: string[]
  sunset: string[]
}

export interface OpenMeteoForecastResponse {
  /** IANA zone Open-Meteo resolved the request to — confirms/echoes the
   * `timezone` query param, and is what `current.time`/`daily.sunrise`/
   * `daily.sunset` are naive-local relative to. */
  timezone: string
  current: OpenMeteoCurrent
  daily: OpenMeteoDaily
}
