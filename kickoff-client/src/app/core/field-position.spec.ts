import { Game } from './models/game.model';
import { isAcrossMidfield, isInFieldGoalRange, isInRedZone } from './field-position';

describe('isInFieldGoalRange', () => {
  it('recognizes possession at or inside the opponent 38', () => {
    expect(isInFieldGoalRange(game('2nd & 8 at AWY 38', 1))).toBeTrue();
    expect(isInFieldGoalRange(game('1st & 10 at AWY 22', 1))).toBeTrue();
  });

  it('does not mark the offense own territory or a spot beyond the opponent 38', () => {
    expect(isInFieldGoalRange(game('3rd & 4 at HOM 31', 1))).toBeFalse();
    expect(isInFieldGoalRange(game('2nd & 7 at AWY 39', 1))).toBeFalse();
  });

  it('supports the provider OPP field-side label', () => {
    expect(isInFieldGoalRange(game('4th & 2 at OPP 29', 1))).toBeTrue();
  });

  it('uses the opponent 20 as the red-zone boundary', () => {
    expect(isInRedZone(game('1st & 10 at AWY 20', 1))).toBeTrue();
    expect(isInRedZone(game('2nd & 4 at AWY 12', 1))).toBeTrue();
    expect(isInRedZone(game('1st & 10 at AWY 21', 1))).toBeFalse();
  });

  it('recognizes the offense only after it has crossed midfield', () => {
    expect(isAcrossMidfield(game('1st & 10 at AWY 49', 1))).toBeTrue();
    expect(isAcrossMidfield(game('2nd & 4 at OPP 41', 1))).toBeTrue();
    expect(isAcrossMidfield(game('1st & 10 at AWY 50', 1))).toBeFalse();
    expect(isAcrossMidfield(game('1st & 10 at HOM 49', 1))).toBeFalse();
  });

  it('requires a visible live game with known possession', () => {
    expect(isInFieldGoalRange(game('2nd & 8 at AWY 30', null))).toBeFalse();
    expect(isInFieldGoalRange({ ...game('2nd & 8 at AWY 30', 1), status: 'Final' })).toBeFalse();
    expect(isInFieldGoalRange({ ...game('2nd & 8 at AWY 30', 1), isMuted: true })).toBeFalse();
  });
});

function game(downDistance: string, possessionTeamId: number | null): Game {
  return {
    id: 1,
    league: 'Ncaa',
    home: { id: 1, displayName: 'Home', abbreviation: 'HOM', logoUrl: null, primaryColor: null, currentRank: null, isFcs: false },
    away: { id: 2, displayName: 'Away', abbreviation: 'AWY', logoUrl: null, primaryColor: null, currentRank: null, isFcs: false },
    kickoffUtc: '2026-09-06T17:00:00Z',
    venue: null,
    broadcasts: [],
    status: 'Live',
    isMuted: false,
    muteType: null,
    score: { homeScore: 10, awayScore: 7, period: 4, clock: '5:00', possessionTeamId, downDistance, homeWinProbability: null },
    hasFavorite: false,
    hasInterest: false,
    isCircled: false,
    weekNumber: 1,
    weekLabel: 'Week 1',
  };
}
