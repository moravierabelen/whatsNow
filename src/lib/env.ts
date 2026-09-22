export const env = {
  get TICKETMASTER_API_KEY(): string | undefined {
    return import.meta.env.VITE_TICKETMASTER_API_KEY as string | undefined
  },
  get JAMBASE_API_KEY(): string | undefined {
    return import.meta.env.VITE_JAMBASE_API_KEY as string | undefined
  },
  get CARTO_API_KEY(): string | undefined {
    return import.meta.env.VITE_CARTO_API_KEY as string | undefined
  },
}
