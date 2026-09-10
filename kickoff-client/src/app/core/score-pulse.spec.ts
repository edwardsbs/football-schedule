import { classifyScoreChange, classifyScoringPlay, scoreEventLabel, scoreIncreaseSide } from './score-pulse';
import { SummaryPlay } from './models/game-summary.model';

describe('score pulse classification', () => {
  const score = (home: number, away: number) => ({ home, away });

  it('uses the subtle treatment for a field goal', () => {
    expect(classifyScoreChange(score(10, 7), score(13, 7))).toBe('field-goal');
  });

  it('uses the prominent treatment for touchdown scoring sequences', () => {
    expect(classifyScoreChange(score(10, 7), score(17, 7))).toBe('touchdown');
    expect(classifyScoreChange(score(10, 7), score(16, 7))).toBe('touchdown');
    expect(classifyScoreChange(score(10, 7), score(18, 7))).toBe('touchdown');
  });

  it('does not react to unchanged scores or corrections', () => {
    expect(classifyScoreChange(score(10, 7), score(10, 7))).toBeNull();
    expect(classifyScoreChange(score(10, 7), score(9, 7))).toBeNull();
  });

  it('keeps safeties and one-point scores subtle', () => {
    expect(classifyScoreChange(score(10, 7), score(12, 7))).toBe('other');
  });

  it('uses the provider scoring-play type when available', () => {
    expect(classifyScoringPlay(play('Passing Touchdown'))).toBe('touchdown');
    expect(classifyScoringPlay(play('Field Goal Good'))).toBe('field-goal');
  });

  it('identifies only the side whose score increased', () => {
    expect(scoreIncreaseSide(score(10, 7), score(13, 7))).toBe('home');
    expect(scoreIncreaseSide(score(10, 7), score(10, 14))).toBe('away');
    expect(scoreIncreaseSide(score(10, 7), score(10, 7))).toBeNull();
  });

  it('provides a stable game-panel label for the scoring celebration', () => {
    expect(scoreEventLabel('touchdown')).toBe('TOUCHDOWN');
    expect(scoreEventLabel('field-goal')).toBe('FIELD GOAL');
    expect(scoreEventLabel('other')).toBe('SCORING PLAY');
    expect(scoreEventLabel(null, 'Extra Point Attempt')).toBe('PAT');
    expect(scoreEventLabel('other', 'Extra Point Good')).toBe('PAT Good');
    expect(scoreEventLabel(null, 'Extra Point No Good')).toBe('PAT No Good');
    expect(scoreEventLabel('other', 'Two-Point Conversion Successful')).toBe('2-PT Conv. Good');
    expect(scoreEventLabel(null, '2-PT Conversion Failed')).toBe('2-PT Conv. Failed');
    expect(scoreEventLabel(null, 'Sack')).toBe('Sack');
    expect(scoreEventLabel(null, 'Interception')).toBe('Interception');
    expect(scoreEventLabel('other', 'Safety')).toBe('Safety');
    expect(scoreEventLabel(null, 'Turnover on Downs')).toBe('4th Down Stop');
    expect(scoreEventLabel(null)).toBeNull();
  });
});

function play(type: string): SummaryPlay {
  return {
    id: '1', text: null, type, teamExternalId: null, period: 1, clock: '10:00',
    isScoringPlay: true, isTurnover: false, isPenalty: false, scoreValue: null,
    homeScore: null, awayScore: null, statYardage: null, start: null, end: null,
  };
}
