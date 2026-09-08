import { rankingMovement } from './ranking-movement';

describe('rankingMovement', () => {
  it('reports movement relative to the previous poll', () => {
    expect(rankingMovement(3, 7, true)).toEqual({ kind: 'up', places: 4 });
    expect(rankingMovement(9, 5, true)).toEqual({ kind: 'down', places: 4 });
    expect(rankingMovement(2, 2, true)).toEqual({ kind: 'same', places: 0 });
  });

  it('distinguishes a newly ranked team from a poll with no history', () => {
    expect(rankingMovement(21, null, true)).toEqual({ kind: 'new', places: 0 });
    expect(rankingMovement(1, null, false)).toEqual({ kind: 'unavailable', places: 0 });
  });
});
