export type RankingMovement =
  | { kind: 'up' | 'down'; places: number }
  | { kind: 'same' | 'new' | 'unavailable'; places: 0 };

/** Translate poll positions into a compact week-over-week rail indicator. */
export function rankingMovement(
  currentRank: number,
  previousRank: number | null | undefined,
  pollHasHistory: boolean,
): RankingMovement {
  if (!pollHasHistory) return { kind: 'unavailable', places: 0 };
  if (previousRank == null) return { kind: 'new', places: 0 };

  const places = previousRank - currentRank;
  if (places > 0) return { kind: 'up', places };
  if (places < 0) return { kind: 'down', places: Math.abs(places) };
  return { kind: 'same', places: 0 };
}
