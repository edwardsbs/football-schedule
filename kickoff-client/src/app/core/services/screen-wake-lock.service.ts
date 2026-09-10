import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, InjectionToken, computed, effect, inject, signal } from '@angular/core';
import { LiveGameStore } from './live-game-store';

export interface WakeLockSentinelLike {
  readonly released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}

export interface ScreenWakeLockApi {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
}

export const SCREEN_WAKE_LOCK_API = new InjectionToken<ScreenWakeLockApi | null>('SCREEN_WAKE_LOCK_API', {
  providedIn: 'root',
  factory: () => {
    const wakeLock = (globalThis.navigator as Navigator & { wakeLock?: ScreenWakeLockApi } | undefined)?.wakeLock;
    return wakeLock ?? null;
  },
});

export type WakeLockState = 'unsupported' | 'idle' | 'requesting' | 'active' | 'blocked';

/** Holds a browser screen wake lock only while a live game exists. The browser
 * releases locks when a document is hidden, so visibility changes explicitly
 * resynchronize and reacquire when the scoreboard returns to the foreground. */
@Injectable({ providedIn: 'root' })
export class ScreenWakeLockService {
  private readonly live = inject(LiveGameStore);
  private readonly api = inject(SCREEN_WAKE_LOCK_API);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly enabled = signal(true);
  readonly state = signal<WakeLockState>(this.api ? 'idle' : 'unsupported');
  readonly hasLiveGame = computed(() => this.live.liveGames().some((game) => game.status === 'Live'));
  readonly shouldHold = computed(() => this.enabled() && this.hasLiveGame());
  readonly statusLabel = computed(() => {
    if (!this.enabled()) return 'Auto wake off';
    switch (this.state()) {
      case 'active': return 'Screen awake';
      case 'requesting': return 'Waking…';
      case 'unsupported': return 'Wake unavailable';
      case 'blocked': return 'Wake blocked';
      default: return 'Auto wake';
    }
  });
  readonly statusDescription = computed(() => {
    if (!this.enabled()) return 'Automatic screen wake is disabled. Tap to enable it.';
    if (this.state() === 'active') return 'The display will stay awake while a game is live.';
    if (this.state() === 'unsupported') return 'This browser does not support screen wake lock.';
    if (this.state() === 'blocked') return 'The browser or device declined the screen wake lock.';
    return 'The display will automatically stay awake when a game goes live.';
  });

  private sentinel: WakeLockSentinelLike | null = null;
  private syncVersion = 0;
  private readonly visibilityListener = () => void this.synchronize();

  constructor() {
    effect(() => {
      this.shouldHold();
      void this.synchronize();
    });
    this.document.addEventListener('visibilitychange', this.visibilityListener);
    this.destroyRef.onDestroy(() => {
      this.document.removeEventListener('visibilitychange', this.visibilityListener);
      void this.release();
    });
  }

  toggle(): void {
    this.enabled.update((enabled) => !enabled);
  }

  private async synchronize(): Promise<void> {
    const version = ++this.syncVersion;
    if (!this.api) {
      this.state.set('unsupported');
      return;
    }
    if (!this.shouldHold() || this.document.visibilityState !== 'visible') {
      await this.releaseCurrent();
      if (version === this.syncVersion) this.state.set('idle');
      return;
    }
    if (this.sentinel && !this.sentinel.released) {
      this.state.set('active');
      return;
    }

    this.state.set('requesting');
    try {
      const sentinel = await this.api.request('screen');
      if (version !== this.syncVersion || !this.shouldHold() || this.document.visibilityState !== 'visible') {
        await sentinel.release();
        return;
      }
      this.sentinel = sentinel;
      this.state.set('active');
      sentinel.addEventListener('release', () => {
        if (this.sentinel !== sentinel) return;
        this.sentinel = null;
        this.state.set(this.shouldHold() ? 'blocked' : 'idle');
      });
    } catch {
      if (version === this.syncVersion) this.state.set('blocked');
    }
  }

  private async release(): Promise<void> {
    ++this.syncVersion;
    await this.releaseCurrent();
    if (this.api) this.state.set('idle');
  }

  private async releaseCurrent(): Promise<void> {
    const sentinel = this.sentinel;
    this.sentinel = null;
    if (sentinel && !sentinel.released) await sentinel.release();
  }
}
