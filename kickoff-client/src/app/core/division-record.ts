import { Game, TeamRecord } from './models/game.model';

/** A team's W-L-T restricted to games against opponents in the same scheduling
 * group: an NFL division or an NCAA conference. Independent of the overall
 * TeamRecordStore record, which counts every game regardless of opponent. */
export function groupRecord(
  teamId: number,
  group: string,
  games: Game[],
  groupOf: (teamId: number) => string | null,
): TeamRecord {
  let wins = 0;
  let losses = 0;
  let ties = 0;

  for (const game of games) {
    if (game.status !== 'Final' || !game.score) continue;

    const isHome = game.home.id === teamId;
    const isAway = game.away.id === teamId;
    if (!isHome && !isAway) continue;

    const opponentId = isHome ? game.away.id : game.home.id;
    if (groupOf(opponentId) !== group) continue;

    const teamScore = isHome ? game.score.homeScore : game.score.awayScore;
    const opponentScore = isHome ? game.score.awayScore : game.score.homeScore;
    if (teamScore > opponentScore) wins++;
    else if (teamScore < opponentScore) losses++;
    else ties++;
  }

  return { teamId, wins, losses, ties };
}

export function groupRecordLabel(record: TeamRecord): string {
  return record.ties > 0 ? `${record.wins}-${record.losses}-${record.ties}` : `${record.wins}-${record.losses}`;
}

export const divisionRecord = groupRecord;
export const divisionRecordLabel = groupRecordLabel;
export const conferenceRecord = groupRecord;
export const conferenceRecordLabel = groupRecordLabel;
