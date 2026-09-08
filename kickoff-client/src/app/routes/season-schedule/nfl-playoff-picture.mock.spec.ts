import { MOCK_2025_PLAYOFF_PICTURE } from './nfl-playoff-picture.mock';

describe('NFL playoff picture mock', () => {
  it('contains a seven-team field and a bubble team for each conference', () => {
    expect(MOCK_2025_PLAYOFF_PICTURE.map((conference) => conference.name)).toEqual(['AFC', 'NFC']);
    for (const conference of MOCK_2025_PLAYOFF_PICTURE) {
      expect(conference.teams.map((team) => team.seed)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(conference.bubble.length).toBe(1);
    }
  });
});
