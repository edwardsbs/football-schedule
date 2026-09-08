import { Game } from '../../core/models/game.model';
import { groupMyGames, myGameCountdown } from './my-games-groups';

describe('My Games planner groups', () => {
  const now = new Date('2026-09-08T12:00:00');
  const game = (id: number, kickoffUtc: string, status: Game['status'] = 'Upcoming') =>
    ({ id, kickoffUtc, status }) as Game;

  it('groups games by urgency and keeps live games separate', () => {
    const groups = groupMyGames([
      game(1, '2026-09-08T13:00:00', 'Live'),
      game(2, '2026-09-08T19:00:00'),
      game(3, '2026-09-09T19:00:00'),
      game(4, '2026-09-12T19:00:00'),
      game(5, '2026-09-07T19:00:00', 'Final'),
    ], now);

    expect(groups.map((group) => group.key)).toEqual(['live', 'today', 'tomorrow', 'later', 'recent']);
    expect(groups.map((group) => group.games[0].id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('formats useful countdown precision', () => {
    expect(myGameCountdown(game(1, '2026-09-09T17:00:00'), now.getTime())).toBe('in 1d 5h');
    expect(myGameCountdown(game(2, '2026-09-08T14:15:00'), now.getTime())).toBe('in 2h 15m');
    expect(myGameCountdown(game(3, '2026-09-08T12:00:45'), now.getTime())).toBe('in 45s');
  });
});
