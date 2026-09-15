import type { EventSource } from './event'

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function encodeEventId(source: EventSource): string {
  const json = JSON.stringify([source.provider, source.externalId])
  return toBase64Url(new TextEncoder().encode(json))
}

export function decodeEventId(id: string): EventSource {
  const invalid = () => new Error(`Invalid event id: ${id}`)

  let parsed: unknown
  try {
    const json = new TextDecoder().decode(fromBase64Url(id))
    parsed = JSON.parse(json)
  } catch {
    throw invalid()
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length !== 2 ||
    typeof parsed[0] !== 'string' ||
    parsed[0].length === 0 ||
    typeof parsed[1] !== 'string' ||
    parsed[1].length === 0
  ) {
    throw invalid()
  }

  const [provider, externalId] = parsed
  return { provider: provider as EventSource['provider'], externalId }
}
