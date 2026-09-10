import { NCAA_ALIGNMENT } from '../../core/data/ncaa-alignment.data';
import { NFL_ALIGNMENT } from '../../core/data/nfl-alignment.data';
import { ReceiverRoute } from '../../core/data/receiver-routes.data';
import { AlignmentTeam, LeagueAlignment } from '../../core/models/alignment.model';
import { MatchLeague, MatchTile, matchTilePool } from '../division-match/division-match-data';

export interface RosterGroup {
  key: string;
  label: string;
  teams: MatchTile[];
}

export interface MissingTeamQuestion {
  group: RosterGroup;
  missing: MatchTile;
  visibleTeams: MatchTile[];
  choices: MatchTile[];
}

export interface LogoQuestion {
  correct: MatchTile;
  choices: MatchTile[];
}

export interface RouteQuestion {
  correct: ReceiverRoute;
  choices: ReceiverRoute[];
}

export function rosterGroups(league: MatchLeague): RosterGroup[] {
  const alignment = alignmentFor(league);

  if (league === 'nfl') {
    return alignment.tiers.flatMap((tier) =>
      tier.conferences.flatMap((conference) =>
        conference.divisions.map((division) => ({
          key: division.name,
          label: division.name,
          teams: division.teams.map((team) => quizTeam(team, division.name)),
        })),
      ),
    );
  }

  const groups: RosterGroup[] = [];
  const seen = new Set<string>();
  for (const tier of alignment.tiers) {
    for (const conference of tier.conferences) {
      if (seen.has(conference.shortName)) continue;
      seen.add(conference.shortName);
      const teams = new Map<string, MatchTile>();
      for (const division of conference.divisions) {
        for (const team of division.teams) teams.set(team.name, quizTeam(team, conference.shortName));
      }
      if (teams.size >= 4) groups.push({ key: conference.shortName, label: conference.shortName, teams: [...teams.values()] });
    }
  }
  if (alignment.independents.length >= 4) {
    groups.push({
      key: 'Independents',
      label: 'Independents',
      teams: alignment.independents.map((team) => quizTeam(team, 'Independents')),
    });
  }
  return groups;
}

export function missingTeamQuestion(
  league: MatchLeague,
  random: () => number = Math.random,
  previousGroupKey?: string,
): MissingTeamQuestion {
  const groups = rosterGroups(league);
  const availableGroups = groups.length > 1 ? groups.filter((group) => group.key !== previousGroupKey) : groups;
  const group = pickOne(availableGroups, random);
  const missing = pickOne(group.teams, random);
  const distractors = shuffle(
    matchTilePool(league).filter((team) => team.targetKey !== group.key && team.key !== missing.key),
    random,
  ).slice(0, 3);

  return {
    group,
    missing,
    visibleTeams: group.teams.filter((team) => team.key !== missing.key),
    choices: shuffle([missing, ...distractors], random),
  };
}

export function logoQuestion(
  league: MatchLeague,
  random: () => number = Math.random,
  previousTeamKey?: string,
): LogoQuestion {
  const pool = matchTilePool(league);
  const eligible = pool.length > 1 ? pool.filter((team) => team.key !== previousTeamKey) : pool;
  const correct = pickOne(eligible, random);
  const distractors = shuffle(pool.filter((team) => team.key !== correct.key), random).slice(0, 3);
  return { correct, choices: shuffle([correct, ...distractors], random) };
}

export function routeQuestion(
  pool: ReceiverRoute[],
  random: () => number = Math.random,
  previousRouteNumber?: number | string,
): RouteQuestion {
  const eligible = pool.length > 1 ? pool.filter((route) => route.number !== previousRouteNumber) : pool;
  const correct = pickOne(eligible, random);
  const distractors = shuffle(pool.filter((route) => route.number !== correct.number), random).slice(0, 3);
  return { correct, choices: shuffle([correct, ...distractors], random) };
}

export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function alignmentFor(league: MatchLeague): LeagueAlignment {
  return league === 'nfl' ? NFL_ALIGNMENT : NCAA_ALIGNMENT;
}

function quizTeam(team: AlignmentTeam, targetKey: string): MatchTile {
  return {
    key: team.name,
    name: team.name,
    abbreviation: team.abbreviation ?? null,
    logoUrl: team.logoUrl ?? null,
    targetKey,
  };
}

function pickOne<T>(items: readonly T[], random: () => number): T {
  if (items.length === 0) throw new Error('Cannot build a quiz question from an empty pool.');
  return items[Math.floor(random() * items.length)];
}
