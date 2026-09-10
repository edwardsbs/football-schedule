import { WinProbabilityPoint } from '../../core/models/game-summary.model';

export interface WinProbabilityDisplay {
  home: number;
  away: number;
}

export function winProbabilityDisplay(homeProbability: number | null | undefined): WinProbabilityDisplay | null {
  if (homeProbability == null || !Number.isFinite(homeProbability)) return null;
  const home = Math.round(Math.min(1, Math.max(0, homeProbability)) * 100);
  return { home, away: 100 - home };
}

export function winProbabilityChartPoints(points: readonly WinProbabilityPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const y = 28 - Math.min(1, Math.max(0, points[0].homeWinPercentage)) * 28;
    return `0,${y} 100,${y}`;
  }
  return points.map((point, index) => {
    const x = index / (points.length - 1) * 100;
    const probability = Math.min(1, Math.max(0, point.homeWinPercentage));
    return `${x.toFixed(2)},${(28 - probability * 28).toFixed(2)}`;
  }).join(' ');
}
