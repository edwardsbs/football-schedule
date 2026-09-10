import { matchTilePool } from '../division-match/division-match-data';
import { locationTilePool, US_STATE_TARGETS } from './match-location-data';

describe('Match Location data', () => {
  it('provides all 50 states exactly once', () => {
    expect(US_STATE_TARGETS.length).toBe(50);
    expect(new Set(US_STATE_TARGETS.map((state) => state.code)).size).toBe(50);
  });

  it('locates all 32 NFL teams in a valid state', () => {
    const stateCodes = new Set(US_STATE_TARGETS.map((state) => state.code));
    const pool = locationTilePool('nfl');

    expect(pool.length).toBe(32);
    expect(pool.every((tile) => stateCodes.has(tile.targetKey))).toBeTrue();
  });

  it('locates every NCAA team already available to Division Match', () => {
    const stateCodes = new Set(US_STATE_TARGETS.map((state) => state.code));
    const pool = locationTilePool('ncaa');

    expect(pool.length).toBe(matchTilePool('ncaa').length);
    expect(pool.every((tile) => stateCodes.has(tile.targetKey))).toBeTrue();
  });
});
