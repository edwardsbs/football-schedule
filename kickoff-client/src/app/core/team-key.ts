/** Extracts the numeric ESPN team id from an `.../ncaa/500/{id}.png` logo URL.
 * Shared by anything that has to match static alignment data (name/logo only)
 * against a real backend team id -- the Conferences page and the Find Games
 * conference/division filter both need this join. */
export function ncaaEspnId(logoUrl: string | null | undefined): string | null {
  return logoUrl?.match(/\/ncaa\/500\/(\d+)\.png/)?.[1] ?? null;
}
