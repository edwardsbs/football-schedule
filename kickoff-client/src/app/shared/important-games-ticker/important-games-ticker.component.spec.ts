import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Game } from '../../core/models/game.model';
import { ImportantGamesTickerComponent, isImportantGame, sortImportantGames, watchAlertLevel } from './important-games-ticker.component';

describe('ImportantGamesTickerComponent', () => {
  let fixture: ComponentFixture<ImportantGamesTickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ImportantGamesTickerComponent] }).compileComponents();
    fixture = TestBed.createComponent(ImportantGamesTickerComponent);
  });

  it('includes favorite, circled, and ranked games', () => {
    expect(isImportantGame(game({ hasFavorite: true }))).toBeTrue();
    expect(isImportantGame(game({ isCircled: true }))).toBeTrue();
    expect(isImportantGame(game({ homeRank: 8 }))).toBeTrue();
  });

  it('omits ordinary games', () => {
    expect(isImportantGame(game())).toBeFalse();
  });

  it('orders live first, upcoming by kickoff, and completed games last', () => {
    const final = game({ id: 1, status: 'Final', kickoffUtc: '2026-09-12T16:00:00Z' });
    const later = game({ id: 2, status: 'Upcoming', kickoffUtc: '2026-09-12T22:00:00Z' });
    const live = game({ id: 3, status: 'Live', kickoffUtc: '2026-09-12T20:00:00Z' });
    const sooner = game({ id: 4, status: 'Upcoming', kickoffUtc: '2026-09-12T18:00:00Z' });

    expect(sortImportantGames([final, later, live, sooner]).map((item) => item.id)).toEqual([3, 4, 2, 1]);
  });

  it('orders completed favorites first, circled games second, then the rest by kickoff', () => {
    const laterFavorite = game({ id: 1, status: 'Final', hasFavorite: true, kickoffUtc: '2026-09-12T22:00:00Z' });
    const earlierFavorite = game({ id: 2, status: 'Final', hasFavorite: true, kickoffUtc: '2026-09-12T18:00:00Z' });
    const circled = game({ id: 3, status: 'Final', isCircled: true, kickoffUtc: '2026-09-12T16:00:00Z' });
    const laterRanked = game({ id: 4, status: 'Final', homeRank: 8, kickoffUtc: '2026-09-12T20:00:00Z' });
    const earlierRanked = game({ id: 5, status: 'Final', homeRank: 12, kickoffUtc: '2026-09-12T17:00:00Z' });

    expect(sortImportantGames([laterRanked, circled, laterFavorite, earlierRanked, earlierFavorite]).map((item) => item.id))
      .toEqual([2, 1, 3, 5, 4]);
  });

  it('shows by default and can be hidden and restored', () => {
    fixture.componentRef.setInput('games', [game({ hasFavorite: true })]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.watch-rail')).not.toBeNull();
    const hide = fixture.nativeElement.querySelector('.rail-head button') as HTMLButtonElement;
    hide.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.watch-rail')).toBeNull();
    const show = fixture.nativeElement.querySelector('.show-rail') as HTMLButtonElement;
    expect(show).not.toBeNull();
    show.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.watch-rail')).not.toBeNull();
  });

  it('separates and tints completed games', () => {
    fixture.componentRef.setInput('games', [
      game({ id: 1, hasFavorite: true, status: 'Final' }),
      game({ id: 2, hasFavorite: true, status: 'Upcoming' }),
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.completed-divider').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('.rail-game.completed').length).toBe(1);
  });

  it('alerts for each live-game watch condition', () => {
    expect(watchAlertLevel(game({ status: 'Live', homeRank: 8, score: liveScore(17, 20, 4, '10:00') }))).toBe('single');
    expect(watchAlertLevel(game({ status: 'Live', homeRank: 8, awayIsFcs: true, score: liveScore(17, 20, 4, '10:00') }))).toBe('double');
    expect(watchAlertLevel(game({ status: 'Live', score: liveScore(28, 31, 3, '4:00') }))).toBe('single');
    expect(watchAlertLevel(game({ status: 'Live', homeRank: 8, awayRank: 12, score: liveScore(24, 27, 4, '8:00') }))).toBe('single');
    expect(watchAlertLevel(game({
      status: 'Live',
      score: liveScore(24, 27, 4, '1:30', 1, '2nd & 7 at AWY 35'),
    }))).toBe('single');
  });

  it('does not alert when a late possession is outside scoring-threat territory', () => {
    expect(watchAlertLevel(game({
      status: 'Live',
      score: liveScore(24, 27, 4, '1:30', 1, '2nd & 7 at HOM 35'),
    }))).toBe('none');
  });
});

function game(overrides: {
  id?: number;
  hasFavorite?: boolean;
  isCircled?: boolean;
  homeRank?: number;
  awayRank?: number;
  awayIsFcs?: boolean;
  status?: Game['status'];
  kickoffUtc?: string;
  score?: Game['score'];
} = {}): Game {
  return {
    id: overrides.id ?? 1,
    league: 'Ncaa',
    home: { id: 1, displayName: 'Home', abbreviation: 'HOM', logoUrl: null, primaryColor: null, currentRank: overrides.homeRank ?? null, isFcs: false },
    away: { id: 2, displayName: 'Away', abbreviation: 'AWY', logoUrl: null, primaryColor: null, currentRank: overrides.awayRank ?? null, isFcs: overrides.awayIsFcs ?? false },
    kickoffUtc: overrides.kickoffUtc ?? '2026-09-12T17:00:00Z',
    venue: null,
    broadcasts: [],
    status: overrides.status ?? 'Upcoming',
    isMuted: false,
    muteType: null,
    score: overrides.score ?? null,
    hasFavorite: overrides.hasFavorite ?? false,
    isCircled: overrides.isCircled ?? false,
    weekNumber: 2,
    weekLabel: 'Week 2',
  };
}

function liveScore(
  homeScore: number,
  awayScore: number,
  period: number,
  clock: string,
  possessionTeamId: number | null = null,
  downDistance: string | null = null,
): NonNullable<Game['score']> {
  return { homeScore, awayScore, period, clock, possessionTeamId, downDistance, homeWinProbability: null };
}
