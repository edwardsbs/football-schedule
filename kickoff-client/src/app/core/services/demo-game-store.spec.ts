import { isInFieldGoalRange, isInRedZone } from '../field-position';
import { classifyScoreChange } from '../score-pulse';
import { buildDemoGames } from './demo-game-store';

describe('mock game simulator', () => {
  const day = new Date(2026, 8, 12);

  it('moves the NFL offense through field-goal range and the red zone', () => {
    const atThe38 = buildDemoGames(day, 4)[0];
    const inTheRedZone = buildDemoGames(day, 6)[0];

    expect(atThe38.score?.downDistance).toContain('RNO 38');
    expect(isInFieldGoalRange(atThe38)).toBeTrue();
    expect(isInRedZone(atThe38)).toBeFalse();
    expect(isInRedZone(inTheRedZone)).toBeTrue();
  });

  it('runs a touchdown, extra point, kickoff, and field goal sequence', () => {
    const beforeTouchdown = buildDemoGames(day, 9)[0].score!;
    const touchdown = buildDemoGames(day, 10)[0].score!;
    const patAttempt = buildDemoGames(day, 15)[0].score!;
    const patGood = buildDemoGames(day, 18)[0].score!;
    const kickoff = buildDemoGames(day, 23)[0].score!;
    const beforeFieldGoal = buildDemoGames(day, 36)[0].score!;
    const fieldGoal = buildDemoGames(day, 37)[0].score!;
    const secondKickoff = buildDemoGames(day, 42)[0].score!;

    expect(classifyScoreChange(
      { home: beforeTouchdown.homeScore, away: beforeTouchdown.awayScore },
      { home: touchdown.homeScore, away: touchdown.awayScore },
    )).toBe('touchdown');
    expect(touchdown.awayScore).toBe(6);
    expect(touchdown.downDistance).toBe('Touchdown');
    expect(patAttempt.awayScore).toBe(6);
    expect(patAttempt.downDistance).toBe('PAT');
    expect(patGood.awayScore).toBe(7);
    expect(patGood.downDistance).toBe('PAT Good');
    expect(kickoff.downDistance).toBe('Kickoff');
    expect(kickoff.possessionTeamId).toBeNull();
    expect(classifyScoreChange(
      { home: beforeFieldGoal.homeScore, away: beforeFieldGoal.awayScore },
      { home: fieldGoal.homeScore, away: fieldGoal.awayScore },
    )).toBe('field-goal');
    expect(fieldGoal.homeScore + fieldGoal.awayScore).toBe(10);
    expect(fieldGoal.downDistance).toBe('Field Goal');
    expect(secondKickoff.downDistance).toBe('Kickoff');
  });

  it('occasionally misses an extra point without changing the score', () => {
    const beforeAttemptResult = buildDemoGames(day, 47 + 17)[0].score!;
    const missedAttempt = buildDemoGames(day, 47 + 18)[0].score!;

    expect(missedAttempt.awayScore).toBe(beforeAttemptResult.awayScore);
    expect(missedAttempt.downDistance).toBe('PAT No Good');
  });

  it('also runs successful and failed two-point conversions', () => {
    const ncaaAttempt = buildDemoGames(day, 7 + 15)[1].score!;
    const ncaaGood = buildDemoGames(day, 7 + 18)[1].score!;
    const ncaaBeforeFailed = buildDemoGames(day, 7 + 47 + 17)[1].score!;
    const ncaaFailed = buildDemoGames(day, 7 + 47 + 18)[1].score!;

    expect(ncaaAttempt.downDistance).toBe('2-PT Conv.');
    expect(ncaaGood.downDistance).toBe('2-PT Conv. Good');
    expect(ncaaGood.homeScore).toBe(8);
    expect(ncaaFailed.downDistance).toBe('2-PT Conv. Failed');
    expect(ncaaFailed.homeScore).toBe(ncaaBeforeFailed.homeScore);
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

    expect(nflAtTen.score!.homeScore + nflAtTen.score!.awayScore).toBe(6);
    expect(ncaaAtTen.score!.homeScore + ncaaAtTen.score!.awayScore).toBe(0);
    expect(ncaaAtSeventeen.score!.homeScore + ncaaAtSeventeen.score!.awayScore).toBe(6);
  });
});
