import { stadiumPool, stadiumQuestion } from './stadium-game-data';

describe('stadium game data', () => {
  it('builds substantial NFL and NCAA stadium pools from known teams', () => {
    expect(stadiumPool('nfl').length).toBeGreaterThan(20);
    expect(stadiumPool('ncaa').length).toBeGreaterThan(20);
  });

  it('uses the current names for Denver and Green Bay', () => {
    const nfl = stadiumPool('nfl');
    expect(nfl.find((entry) => entry.team.name === 'Denver Broncos')?.name).toBe('Empower Field at Mile High');
    expect(nfl.find((entry) => entry.team.name === 'Green Bay Packers')?.name).toBe('Lambeau Field');
  });

  it('returns the home team among four unique choices', () => {
    const question = stadiumQuestion('nfl', () => 0.3);
    expect(question.choices).toContain(question.stadium.team);
    expect(question.choices.length).toBe(4);
    expect(new Set(question.choices.map((team) => team.key)).size).toBe(4);
  });

  it('does not repeat the immediately previous stadium', () => {
    const first = stadiumQuestion('ncaa', () => 0);
    const second = stadiumQuestion('ncaa', () => 0, first.stadium.name);
    expect(second.stadium.name).not.toBe(first.stadium.name);
  });
});
