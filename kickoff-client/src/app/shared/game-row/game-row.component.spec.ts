import { TestBed } from '@angular/core/testing';
import { Game } from '../../core/models/game.model';
import { FanStore } from '../../core/services/fan-store';
import { GameDetailOverlay } from '../../core/services/game-detail-overlay';
import { KickoffApi } from '../../core/services/kickoff-api';
import { GameRowComponent } from './game-row.component';

describe('GameRowComponent', () => {
  it('shows Halftime and hides stale situation data at the end of the second quarter', async () => {
    await TestBed.configureTestingModule({
      imports: [GameRowComponent],
      providers: [
        { provide: KickoffApi, useValue: {} },
        { provide: GameDetailOverlay, useValue: { open: () => undefined } },
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
    const fixture = TestBed.createComponent(GameRowComponent);
    fixture.componentRef.setInput('game', halftimeGame());

    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Halftime');
    expect(text).not.toContain('Q2');
    expect(text).not.toContain('2nd & 10');
    expect(fixture.nativeElement.querySelector('.possession-ball')).toBeNull();
  });
});

function halftimeGame(): Game {
  return {
    id: 1,
    league: 'Ncaa',
    home: { id: 1, displayName: 'Home', abbreviation: 'HOM', logoUrl: null, primaryColor: null },
    away: { id: 2, displayName: 'Away', abbreviation: 'AWY', logoUrl: null, primaryColor: null },
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
