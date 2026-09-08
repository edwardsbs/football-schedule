import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Game, LeagueName, Score, TeamRecord, TeamSummary } from '../models/game.model';
import { GameSummary, SummaryPlay, TeamStatistics } from '../models/game-summary.model';
import { SelectedDayStore } from './selected-day-store';

export const DEMO_NFL_GAME_ID = 9_900_001;
export const DEMO_NCAA_GAME_ID = 9_900_002;
const DRIVE_SECONDS = 24;
const TICK_INTERVAL_MS = 2_000;

type Side = 'home' | 'away';

interface DemoGameConfig {
  id: number;
  league: LeagueName;
  away: TeamSummary;
  home: TeamSummary;
  firstDrive: Side;
  startDelaySeconds: number;
  venue: string;
  city: string;
  state: string;
}

const NFL_CONFIG: DemoGameConfig = {
  id: DEMO_NFL_GAME_ID,
  league: 'Nfl',
  away: team(9_910_001, 'Cedar Rapids Flying Bungholes', 'CRFB', '#e36b2c'),
  home: team(9_910_002, 'Reno Nosepickers', 'RNO', '#6f8edb'),
  firstDrive: 'away',
  startDelaySeconds: 0,
  venue: 'Test Pattern Field',
  city: 'Reno',
  state: 'Nevada',
};

const NCAA_CONFIG: DemoGameConfig = {
  id: DEMO_NCAA_GAME_ID,
  league: 'Ncaa',
  away: team(9_920_001, 'Chattanooga State Snaggletooths', 'CHAT', '#9f6cd4', 17),
  home: team(9_920_002, 'Gulf Shores Bellyflops', 'GSB', '#39a8a3', 23),
  firstDrive: 'home',
  startDelaySeconds: 7,
  venue: 'Sandbox Stadium',
  city: 'Gulf Shores',
  state: 'Alabama',
};

@Injectable({ providedIn: 'root' })
export class DemoGameStore {
  private readonly selectedDay = inject(SelectedDayStore);
  private readonly destroyRef = inject(DestroyRef);
  private intervalId: number | null = null;
  private readonly elapsed = signal(0);
  private readonly mutedIds = signal<ReadonlySet<number>>(new Set());

  readonly enabled = signal(false);
  readonly games = computed<readonly Game[]>(() => {
    if (!this.enabled()) return [];
    const mutedIds = this.mutedIds();
    return buildDemoGames(this.selectedDay.day(), this.elapsed()).map((game) =>
      mutedIds.has(game.id) ? { ...game, isMuted: true, muteType: 'Muted', score: null } : game
    );
  });
  readonly cycleSecond = computed(() => this.elapsed() % DRIVE_SECONDS);

  constructor() {
    this.destroyRef.onDestroy(() => this.stop());
  }

  toggle(): void {
    if (this.enabled()) this.stop();
    else this.start();
  }

  start(): void {
    this.stop();
    this.elapsed.set(0);
    this.mutedIds.set(new Set());
    this.enabled.set(true);
    this.intervalId = window.setInterval(
      () => this.elapsed.update((seconds) => seconds + 1),
      TICK_INTERVAL_MS,
    );
  }

  stop(): void {
    if (this.intervalId !== null) window.clearInterval(this.intervalId);
    this.intervalId = null;
    this.enabled.set(false);
  }

  isDemoGame(gameId: number): boolean {
    return gameId === DEMO_NFL_GAME_ID || gameId === DEMO_NCAA_GAME_ID;
  }

  game(gameId: number): Game | null {
    return this.games().find((game) => game.id === gameId) ?? null;
  }

  record(teamId: number): TeamRecord | null {
    const records: Record<number, Omit<TeamRecord, 'teamId'>> = {
      [NFL_CONFIG.away.id]: { wins: 1, losses: 0, ties: 0 },
      [NFL_CONFIG.home.id]: { wins: 0, losses: 1, ties: 0 },
      [NCAA_CONFIG.away.id]: { wins: 2, losses: 0, ties: 0 },
      [NCAA_CONFIG.home.id]: { wins: 1, losses: 1, ties: 0 },
    };
    const record = records[teamId];
    return record ? { teamId, ...record } : null;
  }

  summary(gameId: number): GameSummary | null {
    const config = configFor(gameId);
    const game = this.game(gameId);
    return config && game?.score ? buildDemoSummary(config, game, this.elapsed()) : null;
  }

  setMuted(gameId: number, muted: boolean): boolean {
    if (!this.isDemoGame(gameId)) return false;
    const next = new Set(this.mutedIds());
    if (muted) next.add(gameId);
    else next.delete(gameId);
    this.mutedIds.set(next);
    return true;
  }
}

export function buildDemoGames(day: Date, elapsedSeconds: number): Game[] {
  return [
    buildDemoGame(NFL_CONFIG, day, elapsedSeconds),
    buildDemoGame(NCAA_CONFIG, day, elapsedSeconds),
  ];
}

function buildDemoGame(config: DemoGameConfig, day: Date, elapsedSeconds: number): Game {
  const kickoff = new Date(day);
  kickoff.setHours(12, 0, 0, 0);
  const score = buildScore(config, elapsedSeconds);
  const weekNumber = config.league === 'Ncaa' ? ncaaWeek(day) : nflWeek(day);

  return {
    id: config.id,
    league: config.league,
    away: config.away,
    home: config.home,
    kickoffUtc: kickoff.toISOString(),
    venue: `${config.venue} · ${config.city}, ${config.state}`,
    broadcasts: [{ network: 'KICKOFF LAB', isStreaming: true }],
    status: 'Live',
    isMuted: false,
    muteType: null,
    score,
    hasFavorite: true,
    hasInterest: true,
    isCircled: true,
    weekNumber,
    weekLabel: `Week ${weekNumber}`,
  };
}

function buildScore(config: DemoGameConfig, elapsedSeconds: number): Score {
  elapsedSeconds = scenarioElapsed(config, elapsedSeconds);
  const cycle = Math.floor(elapsedSeconds / DRIVE_SECONDS);
  const phase = elapsedSeconds % DRIVE_SECONDS;
  const first = config.firstDrive;
  const second: Side = first === 'away' ? 'home' : 'away';
  let awayScore = cycle * (first === 'away' ? 7 : 3);
  let homeScore = cycle * (first === 'home' ? 7 : 3);

  if (phase >= 10) {
    if (first === 'away') awayScore += 7;
    else homeScore += 7;
  }
  if (phase >= 20) {
    if (second === 'away') awayScore += 3;
    else homeScore += 3;
  }

  const drive = phase <= 10
    ? driveSituation(config, first, phase)
    : phase <= 20
      ? driveSituation(config, second, phase - 11)
      : { possessionTeamId: null, downDistance: 'Kickoff' };
  const quarterPhase = elapsedSeconds % 48;
  const remainingSeconds = Math.max(0, 15 * 60 - quarterPhase * 18);

  return {
    homeScore,
    awayScore,
    period: Math.floor(elapsedSeconds / 48) % 4 + 1,
    clock: clockLabel(remainingSeconds),
    possessionTeamId: drive.possessionTeamId,
    downDistance: drive.downDistance,
    homeWinProbability: homeScore === awayScore ? 0.5 : homeScore > awayScore ? 0.62 : 0.38,
  };
}

function driveSituation(
  config: DemoGameConfig,
  side: Side,
  driveSecond: number,
): { possessionTeamId: number; downDistance: string } {
  const offense = config[side];
  const defense = side === 'home' ? config.away : config.home;
  if (driveSecond >= 9) {
    return {
      possessionTeamId: offense.id,
      downDistance: driveSecond >= 10 ? 'Touchdown' : `3rd & Goal at ${defense.abbreviation} 5`,
    };
  }

  const situations = [
    `1st & 10 at ${offense.abbreviation} 25`,
    `2nd & 6 at ${offense.abbreviation} 29`,
    `1st & 10 at ${offense.abbreviation} 42`,
    `2nd & 7 at ${defense.abbreviation} 48`,
    `1st & 10 at ${defense.abbreviation} 35`,
    `2nd & 5 at ${defense.abbreviation} 30`,
    `1st & 10 at ${defense.abbreviation} 19`,
    `2nd & 6 at ${defense.abbreviation} 15`,
    `3rd & 2 at ${defense.abbreviation} 8`,
  ];
  return {
    possessionTeamId: offense.id,
    downDistance: situations[Math.min(driveSecond, situations.length - 1)],
  };
}

function buildDemoSummary(config: DemoGameConfig, game: Game, elapsedSeconds: number): GameSummary {
  elapsedSeconds = scenarioElapsed(config, elapsedSeconds);
  const score = game.score!;
  const phase = elapsedSeconds % DRIVE_SECONDS;
  const currentSide: Side = phase <= 10 ? config.firstDrive : config.firstDrive === 'away' ? 'home' : 'away';
  const offense = config[currentSide];
  const yards = Math.min(95, (phase <= 10 ? phase : phase - 11) * 10);
  const scoringPlays: SummaryPlay[] = [];
  if (score.awayScore + score.homeScore > 0) {
    scoringPlays.push(scoringPlay(config.firstDrive, config, 'Touchdown', 7, score));
  }
  if (phase >= 20 || elapsedSeconds >= DRIVE_SECONDS) {
    const second: Side = config.firstDrive === 'away' ? 'home' : 'away';
    scoringPlays.push(scoringPlay(second, config, 'Field Goal', 3, score));
  }

  return {
    retrievedUtc: new Date().toISOString(),
    lastPlay: scoringPlays.at(-1) ?? null,
    currentDrive: {
      teamExternalId: String(offense.id),
      description: score.downDistance,
      result: phase === 10 ? 'Touchdown' : phase === 20 ? 'Field Goal' : null,
      timeElapsed: `0:${String(Math.min(59, phase)).padStart(2, '0')}`,
      plays: Math.min(10, phase <= 10 ? phase + 1 : phase - 10),
      yards,
      isScore: phase === 10 || phase === 20,
      start: null,
      end: null,
    },
    scoringPlays,
    homeWinProbability: score.homeWinProbability,
    winProbability: [],
    teamStatistics: demoStatistics(config, elapsedSeconds),
    leaders: [],
    context: {
      venue: config.venue,
      city: config.city,
      state: config.state,
      grass: true,
      attendance: 42_424,
      venueImageUrl: null,
    },
    market: null,
    standings: [],
    news: [],
  };
}

function scenarioElapsed(config: DemoGameConfig, elapsedSeconds: number): number {
  return Math.max(0, elapsedSeconds - config.startDelaySeconds);
}

function demoStatistics(config: DemoGameConfig, elapsedSeconds: number): TeamStatistics[] {
  const total = 70 + elapsedSeconds * 7;
  return [config.away, config.home].map((team, index) => ({
    teamExternalId: String(team.id),
    teamAbbreviation: team.abbreviation,
    statistics: [
      { name: 'totalYards', label: 'Total Yards', displayValue: String(total + index * 11) },
      { name: 'passingYards', label: 'Passing Yards', displayValue: String(Math.round(total * 0.62) + index * 8) },
      { name: 'rushingYards', label: 'Rushing Yards', displayValue: String(Math.round(total * 0.38) + index * 3) },
      { name: 'thirdDownEff', label: '3rd Down', displayValue: `${2 + index}/${4 + index}` },
      { name: 'turnovers', label: 'Turnovers', displayValue: '0' },
      { name: 'possessionTime', label: 'Possession', displayValue: `1${index}:2${elapsedSeconds % 10}` },
    ],
  }));
}

function scoringPlay(side: Side, config: DemoGameConfig, type: string, value: number, score: Score): SummaryPlay {
  const team = config[side];
  return {
    id: `demo-${type}-${side}`,
    text: `${team.displayName} ${type.toLowerCase()}`,
    type,
    teamExternalId: String(team.id),
    period: score.period,
    clock: score.clock,
    isScoringPlay: true,
    isTurnover: false,
    isPenalty: false,
    scoreValue: value,
    homeScore: score.homeScore,
    awayScore: score.awayScore,
    statYardage: null,
    start: null,
    end: null,
  };
}

function configFor(gameId: number): DemoGameConfig | null {
  if (gameId === DEMO_NFL_GAME_ID) return NFL_CONFIG;
  if (gameId === DEMO_NCAA_GAME_ID) return NCAA_CONFIG;
  return null;
}

function team(id: number, displayName: string, abbreviation: string, primaryColor: string, rank: number | null = null): TeamSummary {
  return { id, displayName, abbreviation, logoUrl: null, primaryColor, currentRank: rank, isFcs: false };
}

function clockLabel(totalSeconds: number): string {
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

function ncaaWeek(day: Date): number {
  const anchor = new Date(day.getFullYear(), 8, 1);
  return Math.max(0, Math.floor((day.getTime() - anchor.getTime()) / 604_800_000) + 1);
}

function nflWeek(day: Date): number {
  const anchor = new Date(day.getFullYear(), 8, 8);
  return Math.max(1, Math.floor((day.getTime() - anchor.getTime()) / 604_800_000) + 1);
}
