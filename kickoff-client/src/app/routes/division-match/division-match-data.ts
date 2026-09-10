import { NCAA_ALIGNMENT } from '../../core/data/ncaa-alignment.data';
import { NFL_ALIGNMENT } from '../../core/data/nfl-alignment.data';
import { AlignmentTeam, LeagueAlignment } from '../../core/models/alignment.model';

export type MatchLeague = 'nfl' | 'ncaa';

export interface MatchTarget {
  key: string;
  label: string;
}

export interface MatchTile {
  key: string;
  name: string;
  abbreviation: string | null;
  logoUrl: string | null;
  targetKey: string;
}

function alignmentFor(league: MatchLeague): LeagueAlignment {
  return league === 'nfl' ? NFL_ALIGNMENT : NCAA_ALIGNMENT;
}

/** NFL groups at division level (8 real divisions); NCAA groups at conference
 * level -- its "divisions" are a stylized in-conference split, not something a
 * fan would realistically be quizzed on. Same convention Find Games uses. */
export function matchTargets(league: MatchLeague): MatchTarget[] {
  const alignment = alignmentFor(league);
  const targets: MatchTarget[] = [];
  const seen = new Set<string>();

  for (const tier of alignment.tiers) {
    for (const conference of tier.conferences) {
      if (league === 'nfl') {
        for (const division of conference.divisions) targets.push({ key: division.name, label: division.name });
      } else if (!seen.has(conference.shortName)) {
        seen.add(conference.shortName);
        targets.push({ key: conference.shortName, label: conference.shortName });
      }
    }
  }
  if (alignment.independents.length) targets.push({ key: 'Independents', label: 'Independents' });
  return targets;
}

/** Every team as a tile tagged with its correct target. A team appearing in
 * more than one conference in the source data (a known quirk -- some NCAA
 * teams are listed under two conferences) resolves to whichever one is
 * encountered last, the same rule the real conference lookup already uses. */
export function matchTilePool(league: MatchLeague): MatchTile[] {
  const alignment = alignmentFor(league);
  const byName = new Map<string, MatchTile>();

  const record = (team: AlignmentTeam, targetKey: string) => {
    byName.set(team.name, {
      key: team.name,
      name: team.name,
      abbreviation: team.abbreviation ?? null,
      logoUrl: team.logoUrl ?? null,
      targetKey,
    });
  };

  for (const tier of alignment.tiers) {
    for (const conference of tier.conferences) {
      for (const division of conference.divisions) {
        const targetKey = league === 'nfl' ? division.name : conference.shortName;
        for (const team of division.teams) record(team, targetKey);
      }
    }
  }
  for (const team of alignment.independents) record(team, 'Independents');

  return [...byName.values()];
}

/** Fisher-Yates shuffle, then take the first `size` -- `random` is injectable
 * so rounds are deterministic in tests. */
export function pickRound(pool: MatchTile[], size: number, random: () => number = Math.random): MatchTile[] {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(size, shuffled.length));
}
