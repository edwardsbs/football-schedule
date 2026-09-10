import { Game, TeamRecord } from './models/game.model';

export interface PlayoffTeamEntry {
  teamId: number;
  displayName: string;
  abbreviation: string;
  logoUrl: string | null;
  /** Real division label, e.g. "AFC East" (from TeamConferenceStore). */
  division: string;
  record: TeamRecord;
}

export interface PlayoffSeed {
  seed: number;
  teamId: number;
  displayName: string;
  abbreviation: string;
  logoUrl: string | null;
  recordLabel: string;
  isBye: boolean;
  isDivisionWinner: boolean;
}

export interface ConferencePlayoffPicture {
  name: 'AFC' | 'NFC';
  /** Seeds 1-7: the 4 division winners (by record), then the 3 best remaining
   * records as wild cards. Only seed 1 gets a first-round bye. */
  seeds: PlayoffSeed[];
  /** The next couple of teams outside the field -- "on the bubble" today, not
   * a claim that anyone ahead of them is mathematically safe yet. */
  nextIn: PlayoffSeed[];
}

function winPct(record: TeamRecord): number {
  const games = record.wins + record.losses + record.ties;
  return games === 0 ? 0 : (record.wins + record.ties * 0.5) / games;
}

function recordLabel(record: TeamRecord): string {
  return record.ties > 0 ? `${record.wins}-${record.losses}-${record.ties}` : `${record.wins}-${record.losses}`;
}

/** -1 if `a` won the season series, 1 if `b` did, 0 if they haven't played
 * (or split a two-game series) this season. */
function headToHead(a: PlayoffTeamEntry, b: PlayoffTeamEntry, games: Game[]): number {
  let aWins = 0;
  let bWins = 0;
  for (const game of games) {
    if (game.status !== 'Final' || !game.score) continue;
    const isAHome = game.home.id === a.teamId && game.away.id === b.teamId;
    const isBHome = game.home.id === b.teamId && game.away.id === a.teamId;
    if (!isAHome && !isBHome) continue;

    const homeWon = game.score.homeScore > game.score.awayScore;
    const awayWon = game.score.awayScore > game.score.homeScore;
    if (isAHome && homeWon) aWins++;
    else if (isAHome && awayWon) bWins++;
    else if (isBHome && homeWon) bWins++;
    else if (isBHome && awayWon) aWins++;
  }
  if (aWins === bWins) return 0;
  return aWins > bWins ? -1 : 1;
}

/** Simplified seeding order: win% first, then this season's head-to-head,
 * then total wins, then name as a stable last resort. This is NOT the full
 * official NFL tiebreaker procedure -- division record, common games,
 * conference record, and strength of victory/schedule are real tiebreakers
 * this intentionally skips, so a tie this doesn't resolve "correctly" against
 * the real NFL rules is a known, accepted simplification. */
function compareEntries(a: PlayoffTeamEntry, b: PlayoffTeamEntry, games: Game[]): number {
  const pctDiff = winPct(b.record) - winPct(a.record);
  if (Math.abs(pctDiff) > 1e-9) return pctDiff > 0 ? 1 : -1;

  const h2h = headToHead(a, b, games);
  if (h2h !== 0) return h2h;

  if (a.record.wins !== b.record.wins) return b.record.wins - a.record.wins;
  return a.displayName.localeCompare(b.displayName);
}

function toSeed(entry: PlayoffTeamEntry, seed: number, isDivisionWinner: boolean): PlayoffSeed {
  return {
    seed,
    teamId: entry.teamId,
    displayName: entry.displayName,
    abbreviation: entry.abbreviation,
    logoUrl: entry.logoUrl,
    recordLabel: recordLabel(entry.record),
    isBye: seed === 1,
    isDivisionWinner,
  };
}

/** Builds the current AFC/NFC playoff picture from real team records: the 4
 * division winners seeded 1-4 by record, then the next-best 3 records in the
 * conference as wild cards (5-7), with the following 2 shown as "next in". */
export function buildPlayoffPicture(entries: PlayoffTeamEntry[], games: Game[]): ConferencePlayoffPicture[] {
  return (['AFC', 'NFC'] as const).map((name) => {
    const inConference = entries.filter((e) => e.division.startsWith(name));

    const byDivision = new Map<string, PlayoffTeamEntry[]>();
    for (const entry of inConference) {
      const list = byDivision.get(entry.division);
      if (list) list.push(entry);
      else byDivision.set(entry.division, [entry]);
    }

    const winners = [...byDivision.values()]
      .map((teams) => [...teams].sort((a, b) => compareEntries(a, b, games))[0])
      .filter((w): w is PlayoffTeamEntry => w !== undefined)
      .sort((a, b) => compareEntries(a, b, games));

    const winnerIds = new Set(winners.map((w) => w.teamId));
    const wildcardPool = inConference
      .filter((e) => !winnerIds.has(e.teamId))
      .sort((a, b) => compareEntries(a, b, games));

    const seeds = [
      ...winners.map((w, i) => toSeed(w, i + 1, true)),
      ...wildcardPool.slice(0, 3).map((w, i) => toSeed(w, i + 5, false)),
    ];
    const nextIn = wildcardPool.slice(3, 5).map((w, i) => toSeed(w, i + 8, false));

    return { name, seeds, nextIn };
  });
}
