import { advanceSeries, DRIVE_PLAYS, fieldGoalIsGood, movementVector } from './kickoff-drive-engine';

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
});

