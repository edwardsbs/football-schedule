import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { Game } from '../../core/models/game.model';
import { FanStore } from '../../core/services/fan-store';
import { GameDetailOverlay } from '../../core/services/game-detail-overlay';
import { KickoffApi } from '../../core/services/kickoff-api';
import { TeamRecordStore } from '../../core/services/team-record-store';
import { DayGameCardComponent } from './day-game-card.component';

describe('DayGameCardComponent Game Day gesture', () => {
  const detail = { open: jasmine.createSpy('open') };

  beforeEach(() => {
    detail.open.calls.reset();
    TestBed.configureTestingModule({
      imports: [DayGameCardComponent],
      providers: [
        { provide: KickoffApi, useValue: { getGameSummary: () => of(null) } },
        {
          provide: FanStore,
          useValue: {
            isFavorite: () => false,
            isInterest: () => false,
            isCircled: () => false,
          },
        },
        { provide: GameDetailOverlay, useValue: detail },
        { provide: TeamRecordStore, useValue: { label: () => '1–0–0' } },
      ],
    });
  });

  it('toggles Game Day after a 650ms hold without opening details', fakeAsync(() => {
    const fixture = createFixture('available');
    const toggled = jasmine.createSpy('toggled');
    fixture.componentInstance.gameDayToggle.subscribe(toggled);
    const card = fixture.nativeElement.querySelector('.game-card') as HTMLElement;

    card.dispatchEvent(pointer('pointerdown', 20, 20));
    tick(649);
    expect(toggled).not.toHaveBeenCalled();

    tick(1);
    card.dispatchEvent(pointer('pointerup', 20, 20));
    expect(toggled).toHaveBeenCalledTimes(1);
    expect(detail.open).not.toHaveBeenCalled();
  }));

  it('keeps a quick tap as the open-details action', () => {
    const fixture = createFixture('available');
    const card = fixture.nativeElement.querySelector('.game-card') as HTMLElement;

    card.dispatchEvent(pointer('pointerdown', 20, 20));
    card.dispatchEvent(pointer('pointerup', 20, 20));

    expect(detail.open).toHaveBeenCalledOnceWith(42);
  });

  it('shows hold intent and does not open details when an incomplete hold is released', fakeAsync(() => {
    const fixture = createFixture('available');
    const toggled = jasmine.createSpy('toggled');
    fixture.componentInstance.gameDayToggle.subscribe(toggled);
    const card = fixture.nativeElement.querySelector('.game-card') as HTMLElement;

    card.dispatchEvent(pointer('pointerdown', 20, 20));
    tick(150);
    fixture.detectChanges();
    expect(card.classList).toContain('long-press-armed');

    card.dispatchEvent(pointer('pointerup', 20, 20));
    expect(toggled).not.toHaveBeenCalled();
    expect(detail.open).not.toHaveBeenCalled();
  }));

  it('cancels a pending hold when the finger moves to scroll', fakeAsync(() => {
    const fixture = createFixture('available');
    const toggled = jasmine.createSpy('toggled');
    fixture.componentInstance.gameDayToggle.subscribe(toggled);
    const card = fixture.nativeElement.querySelector('.game-card') as HTMLElement;

    card.dispatchEvent(pointer('pointerdown', 20, 20));
    card.dispatchEvent(pointer('pointermove', 20, 40));
    tick(700);

    expect(toggled).not.toHaveBeenCalled();
    expect(detail.open).not.toHaveBeenCalled();
  }));

  it('renders the compact selected marker only while on Game Day', () => {
    const fixture = createFixture('selected');
    expect(fixture.nativeElement.querySelector('.game-day-marker')).not.toBeNull();

    fixture.componentRef.setInput('gameDayState', 'available');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.game-day-marker')).toBeNull();
  });

  it('holds the scoring label and green-score state before returning to kickoff', fakeAsync(() => {
    const initial: Game = {
      ...game(),
      status: 'Live',
      score: {
        homeScore: 0,
        awayScore: 0,
        period: 1,
        clock: '12:00',
        possessionTeamId: 2,
        downDistance: '1st & 10 at HOM 25',
        homeWinProbability: null,
      },
    };
    const fixture = createFixture('available', initial);
    const scored: Game = {
      ...initial,
      score: { ...initial.score!, homeScore: 7, clock: '11:42', downDistance: 'Kickoff' },
    };

    fixture.componentRef.setInput('game', scored);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.situation-text').textContent.trim()).toBe('TOUCHDOWN');
    expect(fixture.nativeElement.querySelectorAll('.score')[1].classList).toContain('score-changed');

    tick(20_000);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.situation-text').textContent.trim()).toBe('TOUCHDOWN');
    expect(fixture.nativeElement.querySelectorAll('.score')[1].classList).toContain('score-changed');

    tick(2_500);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.situation-text').textContent.trim()).toBe('Kickoff');
    expect(fixture.nativeElement.querySelectorAll('.score')[1].classList).not.toContain('score-changed');
  }));
});

function createFixture(state: 'available' | 'selected', selectedGame: Game = game()) {
  const fixture = TestBed.createComponent(DayGameCardComponent);
  fixture.componentRef.setInput('game', selectedGame);
  fixture.componentRef.setInput('gameDayState', state);
  fixture.detectChanges();
  return fixture;
}

function pointer(type: string, x: number, y: number): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    button: 0,
    clientX: x,
    clientY: y,
    isPrimary: true,
    pointerId: 1,
  });
}

function game(): Game {
  return {
    id: 42,
    league: 'Nfl',
    away: { id: 1, displayName: 'Away', abbreviation: 'AWY', logoUrl: null, primaryColor: null, currentRank: null, isFcs: false },
    home: { id: 2, displayName: 'Home', abbreviation: 'HOM', logoUrl: null, primaryColor: null, currentRank: null, isFcs: false },
    kickoffUtc: '2026-09-08T17:00:00Z',
    venue: null,
    broadcasts: [],
    status: 'Upcoming',
    isMuted: false,
    muteType: null,
    score: null,
    hasFavorite: false,
    hasInterest: false,
    isCircled: false,
    weekNumber: 1,
    weekLabel: 'Week 1',
  };
}
