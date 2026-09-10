import {
  advanceSeries,
  distanceBetween,
  DRIVE_PLAYS,
  fieldGoalIsGood,
  isOutOfBounds,
  movementVector,
  passChances,
  resolvePass,
  tackleOccurs,
} from './kickoff-drive-engine';

describe('Kickoff Drive engine', () => {
  it('keeps editable route geometry with every play', () => {
    expect(DRIVE_PLAYS.length).toBe(4);
    expect(DRIVE_PLAYS.every((play) => play.routes.x.path.startsWith('M'))).toBeTrue();
    expect(DRIVE_PLAYS.find((play) => play.id === 'slant')?.routes.y.pointAt(1)).toEqual({ x: 304, y: 112 });
  });

  it('normalizes joystick movement and limits it to the control radius', () => {
    expect(movementVector(0, 0, 40)).toEqual({ x: 0, y: 0 });
    const diagonal = movementVector(60, 80, 40);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1, 5);
  });

  it('awards first downs and detects fourth-down turnovers', () => {
    expect(advanceSeries({ ballOn: 32, down: 2, yardsToGo: 7 }, 9)).toEqual({
      ballOn: 41,
      down: 1,
      yardsToGo: 10,
      firstDown: true,
      touchdown: false,
      turnover: false,
    });
    expect(advanceSeries({ ballOn: 50, down: 4, yardsToGo: 3 }, 1).turnover).toBeTrue();
  });

  it('requires enough power and a straight swipe for field goals', () => {
    expect(fieldGoalIsGood(0.9, 0.2)).toBeTrue();
    expect(fieldGoalIsGood(0.4, 0)).toBeFalse();
    expect(fieldGoalIsGood(0.9, 0.8)).toBeFalse();
  });

  it('rewards separation and a clean pocket on passes', () => {
    const open = passChances({ separation: 55, pocketPressure: 60, depth: 18, movement: 0 });
    const risky = passChances({ separation: 10, pocketPressure: 12, depth: 65, movement: 1 });
    expect(open.completion).toBeGreaterThan(risky.completion);
    expect(open.interception).toBeLessThan(risky.interception);
    expect(resolvePass({ separation: 55, pocketPressure: 60, depth: 18, movement: 0 }, 0.5)).toBe('catchable');
  });

  it('resolves interceptions before ordinary incompletions', () => {
    const dangerous = { separation: 4, pocketPressure: 8, depth: 70, movement: 1 };
    expect(resolvePass(dangerous, 0)).toBe('interception');
    expect(resolvePass(dangerous, 0.99)).toBe('incomplete');
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('uses field boundaries and a short juke protection window for tackles', () => {
    expect(isOutOfBounds({ x: 300, y: 27 })).toBeTrue();
    expect(isOutOfBounds({ x: 300, y: 210 })).toBeFalse();
    expect(tackleOccurs(24, 1, false)).toBeTrue();
    expect(tackleOccurs(24, 1, true)).toBeFalse();
    expect(tackleOccurs(24, 0.2, false)).toBeFalse();
  });
});
