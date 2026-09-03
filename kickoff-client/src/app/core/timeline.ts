import { Game } from './models/game.model';

/** Games sharing one kickoff time. */
export interface KickoffSlot {
  key: string;
  kickoff: string; // ISO of the slot
  count: number;
  games: Game[];
}

/** One local calendar day of games, split into kickoff slots. */
export interface DayGroup {
  key: string;
  date: string; // ISO of local day start
  count: number;
  slots: KickoffSlot[];
}

/** One schedule week (the provider's own week, not a calendar week), split into days. */
export interface WeekGroup {
  key: number;
  number: number;
  label: string;
  count: number;
  days: DayGroup[];
}

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Sunday-start week containing d. */
export function startOfWeek(d: Date): Date {
  const x = startOfLocalDay(d);
  return addDays(x, -x.getDay());
}

/** True for a game tied to one of the user's favorite teams, or one they've circled. */
export function isFollowedGame(g: Game): boolean {
  return g.hasFavorite || g.isCircled;
}

/** Keep only games tied to a favorite team or on the circled list (mixes NCAA + NFL). */
export function filterFollowed(games: Game[]): Game[] {
  return games.filter(isFollowedGame);
}

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Group games by exact kickoff (minute precision), ascending. */
export function groupByKickoff(games: Game[]): KickoffSlot[] {
  const map = new Map<string, KickoffSlot>();
  for (const g of games) {
    const key = new Date(g.kickoffUtc).toISOString().slice(0, 16);
    let slot = map.get(key);
    if (!slot) {
      slot = { key, kickoff: g.kickoffUtc, count: 0, games: [] };
      map.set(key, slot);
    }
    slot.games.push(g);
    slot.count++;
  }
  return [...map.values()].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

/** Group games by local day, each day split into kickoff slots. */
export function groupByDay(games: Game[]): DayGroup[] {
  const byDay = new Map<string, Game[]>();
  for (const g of games) {
    const key = localDayKey(new Date(g.kickoffUtc));
    const bucket = byDay.get(key) ?? [];
    bucket.push(g);
    byDay.set(key, bucket);
  }

  return [...byDay.values()]
    .map((gs) => {
      const date = startOfLocalDay(new Date(gs[0].kickoffUtc));
      return {
        key: localDayKey(date),
        date: date.toISOString(),
        count: gs.length,
        slots: groupByKickoff(gs),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Group a full season's games by the provider's own week number, each week
 * further split into days (and each day into kickoff slots). */
export function groupByWeek(games: Game[]): WeekGroup[] {
  const byWeek = new Map<number, Game[]>();
  for (const g of games) {
    const bucket = byWeek.get(g.weekNumber) ?? [];
    bucket.push(g);
    byWeek.set(g.weekNumber, bucket);
  }

  return [...byWeek.entries()]
    .map(([number, gs]) => ({
      key: number,
      number,
      label: gs[0].weekLabel,
      count: gs.length,
      days: groupByDay(gs),
    }))
    .sort((a, b) => a.number - b.number);
}
