/**
 * The dataset has no status field: an editor cancelling a row edits its name
 * instead, always with one of these words.
 */
const MARKER = /\b(?:cancel·lad[ao]|cancel·lat|anul·lad[ao]|anul·lat|susp(?:ès|esa)|ajornad[ao]|ajornat)\b/gi

/**
 * The same words also occur inside real titles ("Institut del Temps Suspès",
 * "Sempre amb les veles suspeses"), so position tells the two apart: an editor
 * announcing a cancellation leads with it, labels it ("Concert suspès:"), or
 * shouts it ("ACTIVITAT CANCEL·LADA"). Covers postponements too — a date that
 * no longer holds is as useless to the reader as one that was called off.
 */
export function isCancelledByName(name: string): boolean {
  for (const match of name.matchAll(MARKER)) {
    const word = match[0]
    const isAnnouncement =
      match.index === 0 || word === word.toUpperCase() || /^\s*[:.*-]/.test(name.slice(match.index + word.length))
    if (isAnnouncement) return true
  }
  return false
}
