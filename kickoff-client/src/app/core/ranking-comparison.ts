import { NcaaRankings, RankedTeam, RankingPoll, RankingRow } from './models/ranking.model';

export function rankingPoll(rankings: NcaaRankings | null, type: 'ap' | 'cfp'): RankingPoll | null {
  return rankings?.polls.find((poll) => poll.type === type) ?? null;
}

/** CFP becomes the display order once it exists; AP fills the season before
 * committee rankings and remains visible as a comparison column afterward. */
export function mergeRankingPolls(rankings: NcaaRankings | null): RankingRow[] {
  const ap = rankingPoll(rankings, 'ap');
  const cfp = rankingPoll(rankings, 'cfp');
  const byTeam = new Map<number, { ap: RankedTeam | null; cfp: RankedTeam | null }>();

  for (const team of ap?.rankings ?? []) byTeam.set(team.teamId, { ap: team, cfp: null });
  for (const team of cfp?.rankings ?? []) {
    const existing = byTeam.get(team.teamId);
    byTeam.set(team.teamId, { ap: existing?.ap ?? null, cfp: team });
  }

  return [...byTeam.values()]
    .map(({ ap: apTeam, cfp: cfpTeam }) => {
      const identity = cfpTeam ?? apTeam!;
      return {
        teamId: identity.teamId,
        displayName: identity.displayName,
        abbreviation: identity.abbreviation,
        logoUrl: identity.logoUrl,
        ap: apTeam,
        cfp: cfpTeam,
      };
    })
    .sort((left, right) =>
      (left.cfp?.rank ?? 99) - (right.cfp?.rank ?? 99)
      || (left.ap?.rank ?? 99) - (right.ap?.rank ?? 99),
    );
}
