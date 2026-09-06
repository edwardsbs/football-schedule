import { TestBed } from '@angular/core/testing';
import { Game } from '../../core/models/game.model';
import { FanStore } from '../../core/services/fan-store';
import { GameDetailOverlay } from '../../core/services/game-detail-overlay';
import { KickoffApi } from '../../core/services/kickoff-api';
import { TeamRecordStore } from '../../core/services/team-record-store';
import { GameRowComponent } from './game-row.component';

describe('GameRowComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameRowComponent],
      providers: [
        { provide: KickoffApi, useValue: {} },
        { provide: GameDetailOverlay, useValue: { open: () => undefined } },
        {
          provide: TeamRecordStore,
          useValue: {
            label: (teamId: number) => teamId === 1 ? '1–0–0' : '0–1–0',
            ariaLabel: (teamId: number) => teamId === 1
              ? '1 win, 0 losses, 0 ties'
              : '0 wins, 1 loss, 0 ties',
          },
        },
        {
          provide: FanStore,
          useValue: {
            isFavorite: () => false,
            isCircled: () => false,
            toggleFavorite: () => undefined,
            toggleCircle: () => undefined,
          },
        },
      ],
    }).compileComponents();
  });

  it('shows Halftime and hides stale situation data at the end of the second quarter', () => {
    const fixture = TestBed.createComponent(GameRowComponent);
    fixture.componentRef.setInput('game', halftimeGame());

    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Halftime');
    expect(text).not.toContain('Q2');
    expect(text).not.toContain('2nd & 10');
    expect(fixture.nativeElement.querySelector('.possession-ball')).toBeNull();
  });

  it('shows the field spot and offensive direction for a live situation', () => {
    const fixture = TestBed.createComponent(GameRowComponent);
    const game = halftimeGame();
    game.score = {
      ...game.score!,
      period: 3,
      clock: '8:42',
      possessionTeamId: game.home.id,
      downDistance: '3rd & 7 at HOM 41',
    };
    fixture.componentRef.setInput('game', game);

    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    const direction = fixture.nativeElement.querySelector('.field-direction') as HTMLElement;
    expect(text).toContain('3rd & 7 at HOM 41');
    expect(direction.textContent?.trim()).toBe('→');
    expect(direction.getAttribute('aria-label')).toBe('Driving right');
  });

  it('shows both records and places the right-side logo before its team name', () => {
    const fixture = TestBed.createComponent(GameRowComponent);
    fixture.componentRef.setInput('game', halftimeGame());

    fixture.detectChanges();

    const recordText = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.team-record'))
      .map((element) => element.textContent?.trim());
    const rightTeamChildren = Array.from<HTMLElement>(fixture.nativeElement.querySelector('.home .team-main').children);
    const rightSideChildren = Array.from<HTMLElement>(fixture.nativeElement.querySelector('.home').children);
    const rightIdentityChildren = Array.from<HTMLElement>(fixture.nativeElement.querySelector('.home-identity').children);

    expect(recordText).toEqual(['0–1–0', '1–0–0']);
    expect(rightSideChildren[0].classList).toContain('star');
    expect(rightTeamChildren[0].tagName).toBe('APP-TEAM-BADGE');
    expect(rightTeamChildren[1].classList).toContain('abbr');
    expect(rightIdentityChildren[1].classList).toContain('team-record');
  });
});

function halftimeGame(): Game {
  return {
    id: 1,
    league: 'Ncaa',
    home: { id: 1, displayName: 'Home', abbreviation: 'HOM', logoUrl: null, primaryColor: null, currentRank: null },
    away: { id: 2, displayName: 'Away', abbreviation: 'AWY', logoUrl: null, primaryColor: null, currentRank: null },
    kickoffUtc: '2026-09-04T00:00:00Z',
    venue: null,
    broadcasts: [],
    status: 'Live',
    isMuted: false,
    muteType: null,
    score: {
      homeScore: 14,
      awayScore: 7,
      period: 2,
      clock: '0:00',
      possessionTeamId: 2,
      downDistance: '2nd & 10',
      homeWinProbability: null,
    },
    hasFavorite: false,
    isCircled: false,
    weekNumber: 1,
    weekLabel: 'Week 1',
  };
}
