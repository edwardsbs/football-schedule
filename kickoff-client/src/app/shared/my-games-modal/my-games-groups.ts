import { Game } from '../../core/models/game.model';
import { addDays, startOfLocalDay } from '../../core/timeline';

export type MyGamesGroupKey = 'live' | 'today' | 'tomorrow' | 'later' | 'recent';

export interface MyGamesGroup {
  key: MyGamesGroupKey;
  label: string;
  games: Game[];
}

/** Organize the quick planner around urgency rather than calendar plumbing. */
export function groupMyGames(games: readonly Game[], now: Date): MyGamesGroup[] {
  const today = startOfLocalDay(now).getTime();
  const tomorrow = addDays(new Date(today), 1).getTime();
  const dayAfterTomorrow = addDays(new Date(today), 2).getTime();
  const buckets = new Map<MyGamesGroupKey, Game[]>();

  const sorted = [...games].sort((left, right) => left.kickoffUtc.localeCompare(right.kickoffUtc));
  for (const game of sorted) {
    const kickoff = new Date(game.kickoffUtc).getTime();
    const key: MyGamesGroupKey = game.status === 'Live'
      ? 'live'
      : kickoff >= today && kickoff < tomorrow
        ? 'today'
        : kickoff >= tomorrow && kickoff < dayAfterTomorrow
          ? 'tomorrow'
          : kickoff >= dayAfterTomorrow
            ? 'later'
            : 'recent';
    const bucket = buckets.get(key) ?? [];
    bucket.push(game);
    buckets.set(key, bucket);
  }

  const order: Array<{ key: MyGamesGroupKey; label: string }> = [
    { key: 'live', label: 'Live' },
    { key: 'today', label: 'Today' },
    { key: 'tomorrow', label: 'Tomorrow' },
    { key: 'later', label: 'Later' },
    { key: 'recent', label: 'Recently completed' },
  ];

  return order.flatMap(({ key, label }) => {
    const groupedGames = buckets.get(key);
    if (!groupedGames?.length) return [];
    return [{ key, label, games: key === 'recent' ? groupedGames.reverse() : groupedGames }];
  });
}

export function myGameCountdown(game: Game, nowMs: number): string {
  if (game.status === 'Live') return 'Live now';
  if (game.status === 'Final') return 'Final';
  if (game.status === 'Postponed') return 'Postponed';
  if (game.status === 'Canceled') return 'Canceled';

  const seconds = Math.max(0, Math.floor((new Date(game.kickoffUtc).getTime() - nowMs) / 1000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);

  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${minutes}m`;
  if (minutes > 0) return `in ${minutes}m`;
  return seconds > 0 ? `in ${seconds}s` : 'Kickoff!';
}
