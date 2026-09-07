import { NCAA_ALIGNMENT } from '../../core/data/ncaa-alignment.data';
import { NFL_ALIGNMENT } from '../../core/data/nfl-alignment.data';
import { Game, TeamSummary } from '../../core/models/game.model';

export type DayLayout = 'status' | 'kickoff' | 'conference';
export type DayGroupKind = 'live' | 'upcoming' | 'completed' | 'standard';

export interface DayViewGroup {
  key: string;
  label: string;
  games: Game[];
  kind: DayGroupKind;
}

interface GroupDefinition {
  key: string;
  label: string;
  order: number;
  kind: DayGroupKind;
}

const NCAA_CONFERENCE_BY_LOGO_ID = buildNcaaConferenceLookup();
const NFL_DIVISION_BY_ABBREVIATION = buildNflDivisionLookup();

export function groupDayGames(games: readonly Game[], layout: DayLayout): DayViewGroup[] {
  const definitions = layout === 'status'
    ? statusGroups(games)
    : layout === 'kickoff'
      ? kickoffGroups(games)
      : conferenceGroups(games);

  return definitions
    .sort((a, b) => a.definition.order - b.definition.order || a.definition.label.localeCompare(b.definition.label))
    .map(({ definition, groupedGames }) => ({
      key: definition.key,
      label: definition.label,
      games: groupedGames,
      kind: definition.kind,
    }));
}

function statusGroups(games: readonly Game[]) {
  return collectGroups(games, (game): GroupDefinition => {
    if (game.status === 'Live') {
      return { key: 'live', label: 'Live now', order: 0, kind: 'live' };
    }
    if (game.status === 'Upcoming') {
      return { key: 'upcoming', label: 'Upcoming', order: 1, kind: 'upcoming' };
    }
    return { key: 'completed', label: 'Completed', order: 2, kind: 'completed' };
  });
}

function kickoffGroups(games: readonly Game[]) {
  return collectGroups(games, (game): GroupDefinition => {
    const hour = new Date(game.kickoffUtc).getHours();
    if (hour < 12) {
      return { key: 'morning', label: 'Morning · before noon', order: 0, kind: 'standard' };
    }
    if (hour < 16) {
      return { key: 'early-afternoon', label: 'Early afternoon · noon–3:59 PM', order: 1, kind: 'standard' };
    }
    if (hour < 18) {
      return { key: 'late-afternoon', label: 'Late afternoon · 4:00–5:59 PM', order: 2, kind: 'standard' };
    }
    return { key: 'prime-time', label: 'Prime time · 6:00 PM and later', order: 3, kind: 'standard' };
  });
}

function conferenceGroups(games: readonly Game[]) {
  return collectGroups(games, (game): GroupDefinition => {
    if (game.league === 'Nfl') {
      const division = nflDivision(game.home) ?? nflDivision(game.away);
      return division
        ? { key: `nfl-${slug(division)}`, label: division, order: 100 + nflDivisionOrder(division), kind: 'standard' }
        : { key: 'nfl-other', label: 'NFL · Other', order: 199, kind: 'standard' };
    }

    const conference = ncaaConference(game.home) ?? ncaaConference(game.away);
    return conference
      ? { key: `ncaa-${slug(conference)}`, label: conference, order: ncaaConferenceOrder(conference), kind: 'standard' }
      : { key: 'ncaa-other', label: 'Other NCAA / FCS', order: 99, kind: 'standard' };
  });
}

function collectGroups(
  games: readonly Game[],
  define: (game: Game) => GroupDefinition,
): Array<{ definition: GroupDefinition; groupedGames: Game[] }> {
  const groups = new Map<string, { definition: GroupDefinition; groupedGames: Game[] }>();
  for (const game of games) {
    const definition = define(game);
    const group = groups.get(definition.key) ?? { definition, groupedGames: [] };
    group.groupedGames.push(game);
    groups.set(definition.key, group);
  }
  return [...groups.values()];
}

function ncaaConference(team: TeamSummary): string | null {
  const logoId = team.logoUrl?.match(/\/ncaa\/500\/(\d+)\.png/i)?.[1];
  return logoId ? (NCAA_CONFERENCE_BY_LOGO_ID.get(logoId) ?? null) : null;
}

function nflDivision(team: TeamSummary): string | null {
  return NFL_DIVISION_BY_ABBREVIATION.get(team.abbreviation.toLowerCase()) ?? null;
}

function buildNcaaConferenceLookup(): ReadonlyMap<string, string> {
  const lookup = new Map<string, string>();
  for (const tier of NCAA_ALIGNMENT.tiers) {
    for (const conference of tier.conferences) {
      for (const division of conference.divisions) {
        for (const team of division.teams) {
          const logoId = team.logoUrl?.match(/\/ncaa\/500\/(\d+)\.png/i)?.[1];
          if (logoId) lookup.set(logoId, conference.shortName);
        }
      }
    }
  }
  for (const team of NCAA_ALIGNMENT.independents) {
    const logoId = team.logoUrl?.match(/\/ncaa\/500\/(\d+)\.png/i)?.[1];
    if (logoId) lookup.set(logoId, 'Independent');
  }
  return lookup;
}

function buildNflDivisionLookup(): ReadonlyMap<string, string> {
  const lookup = new Map<string, string>();
  for (const tier of NFL_ALIGNMENT.tiers) {
    for (const conference of tier.conferences) {
      for (const division of conference.divisions) {
        for (const team of division.teams) {
          if (team.abbreviation) lookup.set(team.abbreviation.toLowerCase(), division.name);
        }
      }
    }
  }
  return lookup;
}

function ncaaConferenceOrder(conference: string): number {
  const order = ['SEC', 'B1G', 'XII', 'ACC', 'PAC-12', 'AAC', 'MWC', 'SUN BELT', 'MAC', 'C-USA', 'Independent'];
  const index = order.indexOf(conference);
  return index === -1 ? 90 : index;
}

function nflDivisionOrder(division: string): number {
  const order = ['AFC East', 'AFC North', 'AFC South', 'AFC West', 'NFC East', 'NFC North', 'NFC South', 'NFC West'];
  const index = order.indexOf(division);
  return index === -1 ? 90 : index;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
