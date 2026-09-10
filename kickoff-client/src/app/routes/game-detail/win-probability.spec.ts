import { winProbabilityChartPoints, winProbabilityDisplay } from './win-probability';

describe('win probability display', () => {
  it('shows complementary whole percentages for both teams', () => {
    expect(winProbabilityDisplay(0.634)).toEqual({ home: 63, away: 37 });
  });

  it('clamps malformed provider percentages to the chart range', () => {
    expect(winProbabilityDisplay(1.2)).toEqual({ home: 100, away: 0 });
    expect(winProbabilityDisplay(-0.1)).toEqual({ home: 0, away: 100 });
  });

  it('draws a flat history line when only a current probability exists', () => {
    expect(winProbabilityChartPoints([{ sequence: 0, playId: null, homeWinPercentage: 0.75 }]))
      .toBe('0,7 100,7');
  });

  it('maps a probability series across the full chart width', () => {
    expect(winProbabilityChartPoints([
      { sequence: 0, playId: '1', homeWinPercentage: 0.5 },
      { sequence: 1, playId: '2', homeWinPercentage: 0.75 },
    ])).toBe('0.00,14.00 100.00,7.00');
  });
});
