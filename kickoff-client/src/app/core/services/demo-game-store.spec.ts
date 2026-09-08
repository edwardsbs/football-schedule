import { isInFieldGoalRange, isInRedZone } from '../field-position';
import { classifyScoreChange } from '../score-pulse';
import { buildDemoGames } from './demo-game-store';

describe('mock game simulator', () => {
  const day = new Date(2026, 8, 12);

  it('moves the NFL offense through field-goal range and the red zone', () => {
    const atThe35 = buildDemoGames(day, 4)[0];
    const inTheRedZone = buildDemoGames(day, 6)[0];

    expect(atThe35.score?.downDistance).toContain('RNO 35');
    expect(isInFieldGoalRange(atThe35)).toBeTrue();
    expect(isInRedZone(atThe35)).toBeFalse();
    expect(isInRedZone(inTheRedZone)).toBeTrue();
  });

  it('scores a touchdown and then a field goal within twenty seconds', () => {
    const beforeTouchdown = buildDemoGames(day, 9)[0].score!;
    const touchdown = buildDemoGames(day, 10)[0].score!;
    const beforeFieldGoal = buildDemoGames(day, 19)[0].score!;
    const fieldGoal = buildDemoGames(day, 20)[0].score!;

    expect(classifyScoreChange(
      { home: beforeTouchdown.homeScore, away: beforeTouchdown.awayScore },
      { home: touchdown.homeScore, away: touchdown.awayScore },
    )).toBe('touchdown');
    expect(classifyScoreChange(
      { home: beforeFieldGoal.homeScore, away: beforeFieldGoal.awayScore },
      { home: fieldGoal.homeScore, away: fieldGoal.awayScore },
    )).toBe('field-goal');
    expect(fieldGoal.homeScore + fieldGoal.awayScore).toBe(10);
  });

  it('runs the NCAA game in the opposite possession direction', () => {
    const [, ncaa] = buildDemoGames(day, 0);
    expect(ncaa.score?.possessionTeamId).toBe(ncaa.home.id);
    expect(ncaa.home.displayName).toContain('Gulf Shores');
    expect(ncaa.away.displayName).toContain('Chattanooga');
  });

  it('staggers the NCAA scoring events behind the NFL game', () => {
    const [nflAtTen, ncaaAtTen] = buildDemoGames(day, 10);
    const [, ncaaAtSeventeen] = buildDemoGames(day, 17);

    expect(nflAtTen.score!.homeScore + nflAtTen.score!.awayScore).toBe(7);
    expect(ncaaAtTen.score!.homeScore + ncaaAtTen.score!.awayScore).toBe(0);
    expect(ncaaAtSeventeen.score!.homeScore + ncaaAtSeventeen.score!.awayScore).toBe(7);
  });
});
