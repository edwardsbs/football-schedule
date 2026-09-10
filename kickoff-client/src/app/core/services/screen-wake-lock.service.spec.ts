import { DOCUMENT } from '@angular/common';
import { signal } from '@angular/core';
import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { Game } from '../models/game.model';
import { LiveGameStore } from './live-game-store';
import {
  SCREEN_WAKE_LOCK_API,
  ScreenWakeLockApi,
  ScreenWakeLockService,
  WakeLockSentinelLike,
} from './screen-wake-lock.service';

class FakeSentinel implements WakeLockSentinelLike {
  released = false;
  releaseCalls = 0;
  private listener?: () => void;

  async release(): Promise<void> {
    this.releaseCalls++;
    this.released = true;
    this.listener?.();
  }

  addEventListener(_type: 'release', listener: () => void): void {
    this.listener = listener;
  }
}

describe('ScreenWakeLockService', () => {
  const games = signal<readonly Game[]>([]);
  let sentinel: FakeSentinel;
  let requests: number;
  let service: ScreenWakeLockService;
  let visibilityState: DocumentVisibilityState;
  let visibilityListener: EventListener | undefined;

  beforeEach(() => {
    games.set([]);
    sentinel = new FakeSentinel();
    requests = 0;
    visibilityState = 'visible';
    visibilityListener = undefined;
    const api: ScreenWakeLockApi = {
      request: async () => {
        requests++;
        return sentinel;
      },
    };
    const document = {
      get visibilityState() { return visibilityState; },
      addEventListener: (type: string, listener: EventListener) => {
        if (type === 'visibilitychange') visibilityListener = listener;
      },
      removeEventListener: () => undefined,
    } as unknown as Document;

    TestBed.configureTestingModule({
      providers: [
        ScreenWakeLockService,
        { provide: LiveGameStore, useValue: { liveGames: games } },
        { provide: SCREEN_WAKE_LOCK_API, useValue: api },
        { provide: DOCUMENT, useValue: document },
      ],
    });
    service = TestBed.inject(ScreenWakeLockService);
    TestBed.flushEffects();
  });

  it('stays idle when no game is live', fakeAsync(() => {
    flushMicrotasks();
    expect(requests).toBe(0);
    expect(service.state()).toBe('idle');
  }));

  it('acquires during a live game and releases after the last final', fakeAsync(() => {
    games.set([game('Live')]);
    TestBed.flushEffects();
    flushMicrotasks();
    expect(requests).toBe(1);
    expect(service.state()).toBe('active');

    games.set([game('Final')]);
    TestBed.flushEffects();
    flushMicrotasks();
    expect(sentinel.releaseCalls).toBe(1);
    expect(service.state()).toBe('idle');
  }));

  it('lets the user disable automatic wake while a game is live', fakeAsync(() => {
    games.set([game('Live')]);
    TestBed.flushEffects();
    flushMicrotasks();
    service.toggle();
    TestBed.flushEffects();
    flushMicrotasks();
    expect(service.enabled()).toBeFalse();
    expect(sentinel.releaseCalls).toBe(1);
    expect(service.statusLabel()).toBe('Auto wake off');
  }));

  it('reacquires after the live-game screen returns to the foreground', fakeAsync(() => {
    games.set([game('Live')]);
    TestBed.flushEffects();
    flushMicrotasks();

    visibilityState = 'hidden';
    visibilityListener?.(new Event('visibilitychange'));
    flushMicrotasks();
    expect(sentinel.releaseCalls).toBe(1);
    expect(service.state()).toBe('idle');

    sentinel = new FakeSentinel();
    visibilityState = 'visible';
    visibilityListener?.(new Event('visibilitychange'));
    flushMicrotasks();
    expect(requests).toBe(2);
    expect(service.state()).toBe('active');
  }));
});

function game(status: Game['status']): Game {
  return {
    id: 1,
    league: 'Nfl',
    home: { id: 1, displayName: 'Home', abbreviation: 'HOM', logoUrl: null, primaryColor: null, currentRank: null, previousRank: null, isFcs: false },
    away: { id: 2, displayName: 'Away', abbreviation: 'AWY', logoUrl: null, primaryColor: null, currentRank: null, previousRank: null, isFcs: false },
    kickoffUtc: '2026-09-10T18:00:00Z',
    venue: null,
    broadcasts: [],
    status,
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
