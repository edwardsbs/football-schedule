import { RECEIVER_ROUTES } from '../../core/data/receiver-routes.data';
import { coreRouteRound, logoQuestion, missingTeamQuestion, mixedRouteRound, rosterGroups, routeQuestion } from './quiz-game-data';

describe('quiz game data', () => {
  it('builds each NFL division as a four-team missing-roster group', () => {
    const groups = rosterGroups('nfl');
    expect(groups.length).toBe(8);
    expect(groups.every((group) => group.teams.length === 4)).toBeTrue();
  });

  it('removes exactly one roster team and includes it among four choices', () => {
    const question = missingTeamQuestion('nfl', () => 0);
    expect(question.visibleTeams.length).toBe(question.group.teams.length - 1);
    expect(question.choices.length).toBe(4);
    expect(question.choices).toContain(question.missing);
    expect(question.visibleTeams).not.toContain(question.missing);
  });

  it('builds a logo question with one correct and three unique distractors', () => {
    const question = logoQuestion('nfl', () => 0.25);
    expect(question.choices.length).toBe(4);
    expect(new Set(question.choices.map((team) => team.key)).size).toBe(4);
    expect(question.choices).toContain(question.correct);
  });

  it('builds a route question with four distinct route names', () => {
    const question = routeQuestion(RECEIVER_ROUTES, () => 0.5);
    expect(question.choices.length).toBe(4);
    expect(new Set(question.choices.map((route) => route.number)).size).toBe(4);
    expect(question.choices).toContain(question.correct);
  });

  it('builds a unique 5-core, 4-advanced, 3-concept mixed round', () => {
    const round = mixedRouteRound(RECEIVER_ROUTES, () => 0.5);
    expect(round.length).toBe(12);
    expect(round.slice(0, 5).every((route) => route.group === 'Core tree')).toBeTrue();
    expect(round.slice(5, 9).every((route) => route.group === 'Advanced routes')).toBeTrue();
    expect(round.slice(9, 12).every((route) => route.group === 'Combination concepts')).toBeTrue();
    expect(new Set(round.map((route) => route.number)).size).toBe(12);
  });

  it('uses each core route exactly once in a core round', () => {
    const round = coreRouteRound(RECEIVER_ROUTES, () => 0.5);
    expect(round.length).toBe(9);
    expect(new Set(round.map((route) => route.number)).size).toBe(9);
  });
});
