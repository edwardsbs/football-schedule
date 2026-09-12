import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, exhaustMap, merge, take, timer } from 'rxjs';
import { Game, Score } from '../models/game.model';
import { KickoffApi } from './kickoff-api';
import { DemoGameStore } from './demo-game-store';

const POLL_MS = 10_000;
const QUIET_FEED_MS = 2 * 60_000;
const STALE_FEED_MS = 5 * 60_000;

export interface LiveFeedHealth {
  level: 'fresh' | 'quiet' | 'stale';
  ageMs: number;
  label: string;
  description: string;
}

/**
 * One app-wide live-game feed. Schedule pages load their normal date range once,
 * then overlay the changing score/status fields from this small shared poll.
 * This avoids re-downloading an entire week or season every ten seconds.
 */
@Injectable({ providedIn: 'root' })
export class LiveGameStore {
  private readonly api = inject(KickoffApi);
  private readonly demo = inject(DemoGameStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refreshRequested = new Subject<void>();
  private readonly updatesById = signal<ReadonlyMap<number, Game>>(new Map());
  private currentLiveIds = new Set<number>();

  private readonly providerLiveGames = signal<readonly Game[]>([]);
  readonly liveGames = computed<readonly Game[]>(() => mergeUniqueGames(this.providerLiveGames(), this.demo.games()));

  constructor() {
    merge(timer(0, POLL_MS), this.refreshRequested)
      .pipe(
        exhaustMap(() => this.api.getLive().pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((games) => this.acceptLiveSnapshot(games));
  }

  refresh(): void {
    this.refreshRequested.next();
  }

  /**
   * Repairs possession/down-and-distance from the richer per-game summary when
   * the lightweight scoreboard keeps advancing the clock without a situation
   * block. The next real scoreboard situation still replaces this normally.
   */
  correctSituation(gameId: number, possessionTeamId: number | null, downDistance: string | null): void {
    const current = this.updatesById().get(gameId);
    if (!current?.score || current.status !== 'Live') return;

    const correctedPossession = possessionTeamId ?? current.score.possessionTeamId;
    const correctedDownDistance = downDistance?.trim() || current.score.downDistance;
    if (correctedPossession === current.score.possessionTeamId
      && correctedDownDistance === current.score.downDistance) return;

    const corrected: Game = {
      ...current,
      score: {
        ...current.score,
        possessionTeamId: correctedPossession,
        downDistance: correctedDownDistance,
      },
    };
    const next = new Map(this.updatesById());
    next.set(gameId, corrected);
    this.updatesById.set(next);
    this.providerLiveGames.update((games) => games.map((game) => game.id === gameId ? corrected : game));
  }

  /**
   * Reports the age of the last actual scoreboard change, rather than the age
   * of the latest identical HTTP response. That distinction exposes a provider
   * feed frozen on an old play even while polling itself is still succeeding.
   */
  health(game: Game, now = Date.now()): LiveFeedHealth | null {
    if (game.status !== 'Live' || isHalftime(game.score)) return null;
    const updatedAt = game.lastUpdatedUtc ? new Date(game.lastUpdatedUtc).getTime() : Number.NaN;
    if (!Number.isFinite(updatedAt)) return null;

    const ageMs = Math.max(0, now - updatedAt);
    const age = compactAge(ageMs);
    if (ageMs >= STALE_FEED_MS) {
      return {
        level: 'stale',
        ageMs,
        label: `Stale ${age}`,
        description: `No real scoreboard change for ${age}. Possession and down-and-distance are hidden until the feed advances.`,
      };
    }
    if (ageMs >= QUIET_FEED_MS) {
      return {
        level: 'quiet',
        ageMs,
        label: `Quiet ${age}`,
        description: `No real scoreboard change for ${age}. The feed is still being checked.`,
      };
    }
    return {
      level: 'fresh',
      ageMs,
      label: `Feed ${age}`,
      description: `Scoreboard changed ${age} ago.`,
    };
  }

  overlay(game: Game): Game {
    const demoGame = this.demo.game(game.id);
    if (demoGame) return demoGame;
    const update = this.updatesById().get(game.id);
    if (!update) return game;

    return {
      ...game,
      kickoffUtc: update.kickoffUtc,
      venue: update.venue,
      broadcasts: update.broadcasts,
      status: update.status,
      lastUpdatedUtc: update.lastUpdatedUtc,
      score: game.isMuted
        ? null
        : hideStaleSituation(update, this.health(update)),
    };
  }

  overlayAll(games: readonly Game[]): Game[] {
    // Read once so Angular tracks this cache when overlayAll is called inside a computed.
    this.updatesById();
    return games.map((game) => this.overlay(game));
  }

  overlayRange(
    games: readonly Game[],
    fromUtc: string,
    toUtc: string,
    league?: 'Nfl' | 'Ncaa',
  ): Game[] {
    const from = new Date(fromUtc).getTime();
    const to = new Date(toUtc).getTime();
    const demos = this.demo.games().filter((game) => {
      const kickoff = new Date(game.kickoffUtc).getTime();
      return kickoff >= from && kickoff < to && (!league || game.league === league);
    });
    return mergeUniqueGames(this.overlayAll(games), demos)
      .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime());
  }

  private acceptLiveSnapshot(games: Game[]): void {
    const nextLiveIds = new Set(games.map((game) => game.id));
    const finishedIds = [...this.currentLiveIds].filter((id) => !nextLiveIds.has(id));

    this.currentLiveIds = nextLiveIds;
    this.cache(games);
    this.providerLiveGames.set(games.map((game) => this.updatesById().get(game.id) ?? game));

    // Once a game becomes final it drops out of /games/live. Fetch it once more
    // so every open view receives the final score instead of reverting to its
    // original page-load snapshot.
    for (const id of finishedIds) {
      this.api
        .getGame(id)
        .pipe(
          take(1),
          catchError(() => EMPTY),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((game) => this.cache([game]));
    }
  }

  private cache(games: readonly Game[]): void {
    if (games.length === 0) return;
    const next = new Map(this.updatesById());
    for (const game of games) {
      const previous = next.get(game.id);
      next.set(game.id, {
        ...game,
        score: retainLiveSituation(
          previous?.score ?? null,
          game.score,
          game.status,
          game.home.id,
          game.away.id,
        ),
      });
    }
    this.updatesById.set(next);
  }
}

function hideStaleSituation(game: Game, health: LiveFeedHealth | null): Score | null {
  if (!game.score || health?.level !== 'stale') return game.score;
  return {
    ...game.score,
    possessionTeamId: null,
    downDistance: null,
  };
}

function isHalftime(score: Score | null): boolean {
  return score?.period === 2 && /^0{1,2}:00$/.test(score.clock?.trim() ?? '');
}

function compactAge(ageMs: number): string {
  if (ageMs < 60_000) return `${Math.max(0, Math.floor(ageMs / 1_000))}s`;
  return `${Math.floor(ageMs / 60_000)}m`;
}

function mergeUniqueGames(first: readonly Game[], second: readonly Game[]): Game[] {
  const merged = new Map<number, Game>();
  for (const game of first) merged.set(game.id, game);
  for (const game of second) merged.set(game.id, game);
  return [...merged.values()];
}

/**
 * Live providers commonly suppress their situation block while a play is being
 * reviewed/updated. Preserve only the situational fields; scores, clock, period,
 * and win probability always come from the newest snapshot.
 */
function retainLiveSituation(
  previous: Score | null,
  current: Score | null,
  status: Game['status'],
  homeTeamId: number,
  awayTeamId: number,
): Score | null {
  if (status !== 'Live' || previous === null || current === null) return current;

  const homeIncrease = current.homeScore - previous.homeScore;
  const awayIncrease = current.awayScore - previous.awayScore;
  const scoringSituation = inferScoringSituation(homeIncrease, awayIncrease);
  const scoringTeamId = homeIncrease > 0 && awayIncrease <= 0
    ? homeTeamId
    : awayIncrease > 0 && homeIncrease <= 0
      ? awayTeamId
      : null;

  if (scoringSituation && scoringTeamId !== null) {
    return {
      ...current,
      possessionTeamId: scoringTeamId,
      downDistance: scoringSituation,
    };
  }

  if (isKickoffSituation(current.downDistance)) {
    const previousTeamKicking = isScoreOrKickoffSituation(previous.downDistance)
      ? previous.possessionTeamId
      : null;
    return {
      ...current,
      possessionTeamId: previousTeamKicking ?? current.possessionTeamId,
      downDistance: current.downDistance,
    };
  }

  // Highlight labels are deliberately ephemeral. If the next sequential poll
  // has no situation block, clear the highlight instead of retaining it as if
  // it were a real down-and-distance value.
  if (isHighlightSituation(previous.downDistance)) {
    return {
      ...current,
      possessionTeamId: current.possessionTeamId,
      downDistance: current.downDistance?.trim() ? current.downDistance : null,
    };
  }

  return {
    ...current,
    possessionTeamId: current.possessionTeamId ?? previous.possessionTeamId,
    downDistance: current.downDistance?.trim() ? current.downDistance : previous.downDistance,
  };
}

function isKickoffSituation(situation: string | null): boolean {
  return /^kickoff$/i.test(situation?.trim() ?? '');
}

function isScoreOrKickoffSituation(situation: string | null): boolean {
  return /^(?:touchdown|field goal|(?:pat|extra point)(?: attempt| good| no good)?|(?:2-pt conv\.|two-point conversion)(?: good| failed| successful| unsuccessful)?|kickoff)$/i
    .test(situation?.trim() ?? '');
}

function isHighlightSituation(situation: string | null): boolean {
  return /^(?:touchdown|field goal|safety|interception|sack|4th down stop)$/i
    .test(situation?.trim() ?? '');
}

function inferScoringSituation(homeIncrease: number, awayIncrease: number): 'Touchdown' | 'Field Goal' | null {
  if (homeIncrease > 0 && awayIncrease > 0) return null;
  const increase = Math.max(homeIncrease, awayIncrease);
  if (increase === 3) return 'Field Goal';
  if (increase >= 6) return 'Touchdown';
  return null;
}
