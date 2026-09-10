import { matchTargets, matchTilePool, pickRound } from './division-match-data';

describe('Division match data', () => {
  it('builds 8 real NFL divisions with no duplicates', () => {
    const targets = matchTargets('nfl');
    expect(targets.length).toBe(8);
    expect(new Set(targets.map((t) => t.key)).size).toBe(8);
  });

  it('builds every team on the NFL tile pool exactly once, one per division', () => {
    const pool = matchTilePool('nfl');
    expect(pool.length).toBe(32);
    expect(new Set(pool.map((t) => t.key)).size).toBe(32);
    for (const target of matchTargets('nfl')) {
      expect(pool.filter((t) => t.targetKey === target.key).length).toBe(4);
    }
  });

  it('groups NCAA at conference level, including Independents', () => {
    const targets = matchTargets('ncaa');
    expect(targets.some((t) => t.key === 'SEC')).toBeTrue();
    expect(targets.some((t) => t.key === 'Independents')).toBeTrue();
    // No division-level labels like "Eastern Division" should leak through.
    expect(targets.some((t) => t.label.includes('Division'))).toBeFalse();
  });

  it('assigns every NCAA tile a target that actually exists', () => {
    const targetKeys = new Set(matchTargets('ncaa').map((t) => t.key));
    for (const tile of matchTilePool('ncaa')) {
      expect(targetKeys.has(tile.targetKey)).toBeTrue();
    }
  });

  it('resolves a team appearing under multiple conferences to a single answer', () => {
    // Washington Huskies appear under both Big Ten and Pac-12 in the source data.
    const pool = matchTilePool('ncaa');
    const washington = pool.filter((t) => t.name === 'Washington Huskies');
    expect(washington.length).toBe(1);
  });
});

describe('Division match round picking', () => {
  const pool = [tile('A'), tile('B'), tile('C'), tile('D'), tile('E')];

  it('returns a round of the requested size', () => {
    expect(pickRound(pool, 3, sequence([0, 0, 0])).length).toBe(3);
  });

  it('caps the round at the pool size', () => {
    expect(pickRound(pool, 99).length).toBe(5);
  });

  it('does not mutate or duplicate the source pool', () => {
    const round = pickRound(pool, 5, sequence([0.9, 0.1, 0.5, 0.2, 0]));
    expect(pool.length).toBe(5);
    expect(new Set(round.map((t) => t.key)).size).toBe(5);
  });

  it('is deterministic for a given random sequence', () => {
    const a = pickRound(pool, 5, sequence([0.9, 0.1, 0.5, 0.2, 0]));
    const b = pickRound(pool, 5, sequence([0.9, 0.1, 0.5, 0.2, 0]));
    expect(a.map((t) => t.key)).toEqual(b.map((t) => t.key));
  });
});

function tile(key: string) {
  return { key, name: key, abbreviation: key, logoUrl: null, targetKey: 'X' };
}

/** Returns a `random()` stand-in that plays back a fixed sequence of values. */
function sequence(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}
