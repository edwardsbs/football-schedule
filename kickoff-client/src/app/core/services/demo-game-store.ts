import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Game, LeagueName, Score, TeamRecord, TeamSummary } from '../models/game.model';
import { GameSummary, SummaryPlay, TeamStatistics } from '../models/game-summary.model';
import { SelectedDayStore } from './selected-day-store';

export const DEMO_NFL_GAME_ID = 9_900_001;
export const DEMO_NCAA_GAME_ID = 9_900_002;
const DRIVE_SECONDS = 47;
const TICK_INTERVAL_MS = 2_000;
const TOUCHDOWN_SECOND = 10;
const CONVERSION_ATTEMPT_SECOND = 15;
const CONVERSION_RESULT_SECOND = 18;
const FIRST_KICKOFF_SECOND = 23;
const SECOND_DRIVE_SECOND = 28;
const FIELD_GOAL_SECOND = 37;
const SECOND_KICKOFF_SECOND = 42;

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

interface ConversionOutcome {
  attempt: 'PAT' | '2-PT Conv.';
  result: 'PAT Good' | 'PAT No Good' | '2-PT Conv. Good' | '2-PT Conv. Failed';
  value: 0 | 1 | 2;
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
  const conversion = conversionOutcome(config, cycle);
  const completed = completedCycleScores(config, cycle);
  let awayScore = completed.away;
  let homeScore = completed.home;

  if (phase >= TOUCHDOWN_SECOND) {
    if (first === 'away') awayScore += 6;
    else homeScore += 6;
  }
  if (phase >= CONVERSION_RESULT_SECOND && conversion.value > 0) {
    if (first === 'away') awayScore += conversion.value;
    else homeScore += conversion.value;
  }
  if (phase >= FIELD_GOAL_SECOND) {
    if (second === 'away') awayScore += 3;
    else homeScore += 3;
  }

  let drive: { possessionTeamId: number | null; downDistance: string };
  if (phase < TOUCHDOWN_SECOND) {
    drive = driveSituation(config, first, phase);
  } else if (phase < CONVERSION_ATTEMPT_SECOND) {
    drive = { possessionTeamId: config[first].id, downDistance: 'Touchdown' };
  } else if (phase < CONVERSION_RESULT_SECOND) {
    drive = { possessionTeamId: config[first].id, downDistance: conversion.attempt };
  } else if (phase < FIRST_KICKOFF_SECOND) {
    drive = {
      possessionTeamId: config[first].id,
      downDistance: conversion.result,
    };
  } else if (phase < SECOND_DRIVE_SECOND) {
    drive = { possessionTeamId: config[first].id, downDistance: 'Kickoff' };
  } else if (phase < FIELD_GOAL_SECOND) {
    drive = driveSituation(config, second, phase - SECOND_DRIVE_SECOND);
  } else if (phase < SECOND_KICKOFF_SECOND) {
    drive = { possessionTeamId: config[second].id, downDistance: 'Field Goal' };
  } else {
    drive = { possessionTeamId: config[second].id, downDistance: 'Kickoff' };
  }
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
    `1st & 10 at ${defense.abbreviation} 38`,
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
  const cycle = Math.floor(elapsedSeconds / DRIVE_SECONDS);
  const phase = elapsedSeconds % DRIVE_SECONDS;
  const conversion = conversionOutcome(config, cycle);
  const second: Side = config.firstDrive === 'away' ? 'home' : 'away';
  const currentSide: Side = phase < SECOND_DRIVE_SECOND || phase >= SECOND_KICKOFF_SECOND
    ? config.firstDrive
    : second;
  const offense = config[currentSide];
  const driveSecond = phase < SECOND_DRIVE_SECOND ? phase : phase - SECOND_DRIVE_SECOND;
  const yards = phase >= TOUCHDOWN_SECOND && phase < SECOND_DRIVE_SECOND
    ? 75
    : phase >= FIELD_GOAL_SECOND
      ? 63
      : Math.min(75, Math.max(0, driveSecond) * 9);
  const scoringPlays: SummaryPlay[] = [];
  if (phase >= TOUCHDOWN_SECOND) {
    scoringPlays.push(scoringPlay(config.firstDrive, config, 'Touchdown', 6, score));
  }
  if (phase >= CONVERSION_RESULT_SECOND && conversion.value > 0) {
    scoringPlays.push(scoringPlay(config.firstDrive, config, conversion.result, conversion.value, score));
  }
  if (phase >= FIELD_GOAL_SECOND) {
    scoringPlays.push(scoringPlay(second, config, 'Field Goal', 3, score));
  }
  const lastPlay = demoLastPlay(config, currentSide, phase, cycle, score);

  return {
    retrievedUtc: new Date().toISOString(),
    lastPlay,
    currentDrive: {
      teamExternalId: String(offense.id),
      description: score.downDistance,
      result: scoringResult(config, phase, cycle),
      timeElapsed: `0:${String(Math.min(59, phase)).padStart(2, '0')}`,
      plays: Math.min(10, Math.max(1, driveSecond + 1)),
      yards,
      isScore: phase === TOUCHDOWN_SECOND
        || (phase === CONVERSION_RESULT_SECOND && conversion.value > 0)
        || phase === FIELD_GOAL_SECOND,
      start: null,
      end: null,
    },
    scoringPlays,
    homeWinProbability: score.homeWinProbability,
    winProbability: [],
    teamStatistics: demoStatistics(config, elapsedSeconds),
    leaders: [],
    injuries: [],
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

function completedCycleScores(config: DemoGameConfig, completedCycles: number): { home: number; away: number } {
  const result = { home: 0, away: 0 };
  const second: Side = config.firstDrive === 'away' ? 'home' : 'away';
  for (let cycle = 0; cycle < completedCycles; cycle += 1) {
    result[config.firstDrive] += 6 + conversionOutcome(config, cycle).value;
    result[second] += 3;
  }
  return result;
}

function conversionOutcome(config: DemoGameConfig, cycle: number): ConversionOutcome {
  const leagueOffset = config.league === 'Ncaa' ? 2 : 0;
  switch ((cycle + leagueOffset) % 4) {
    case 0: return { attempt: 'PAT', result: 'PAT Good', value: 1 };
    case 1: return { attempt: 'PAT', result: 'PAT No Good', value: 0 };
    case 2: return { attempt: '2-PT Conv.', result: '2-PT Conv. Good', value: 2 };
    default: return { attempt: '2-PT Conv.', result: '2-PT Conv. Failed', value: 0 };
  }
}

function scoringResult(config: DemoGameConfig, phase: number, cycle: number): string | null {
  const conversion = conversionOutcome(config, cycle);
  if (phase >= TOUCHDOWN_SECOND && phase < CONVERSION_ATTEMPT_SECOND) return 'Touchdown';
  if (phase >= CONVERSION_ATTEMPT_SECOND && phase < CONVERSION_RESULT_SECOND) return conversion.attempt;
  if (phase >= CONVERSION_RESULT_SECOND && phase < FIRST_KICKOFF_SECOND) {
    return conversion.result;
  }
  if (phase >= FIELD_GOAL_SECOND && phase < SECOND_KICKOFF_SECOND) return 'Field Goal';
  if ((phase >= FIRST_KICKOFF_SECOND && phase < SECOND_DRIVE_SECOND) || phase >= SECOND_KICKOFF_SECOND) {
    return 'Kickoff';
  }
  return null;
}

function demoLastPlay(
  config: DemoGameConfig,
  side: Side,
  phase: number,
  cycle: number,
  score: Score,
): SummaryPlay {
  const conversion = conversionOutcome(config, cycle);
  if (phase >= TOUCHDOWN_SECOND && phase < CONVERSION_ATTEMPT_SECOND) {
    return scoringPlay(config.firstDrive, config, 'Touchdown', 6, score);
  }
  if (phase >= CONVERSION_ATTEMPT_SECOND && phase < CONVERSION_RESULT_SECOND) {
    return play(config.firstDrive, config, conversion.attempt, false, 0, score);
  }
  if (phase >= CONVERSION_RESULT_SECOND && phase < FIRST_KICKOFF_SECOND) {
    return play(config.firstDrive, config, conversion.result, conversion.value > 0, conversion.value, score);
  }
  if (phase >= FIRST_KICKOFF_SECOND && phase < SECOND_DRIVE_SECOND) {
    return play(config.firstDrive, config, 'Kickoff', false, 0, score);
  }
  if (phase >= FIELD_GOAL_SECOND && phase < SECOND_KICKOFF_SECOND) {
    return scoringPlay(side, config, 'Field Goal', 3, score);
  }
  if (phase >= SECOND_KICKOFF_SECOND) {
    return play(side, config, 'Kickoff', false, 0, score);
  }
  return play(side, config, score.downDistance ?? 'Drive', false, 0, score);
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
  return play(side, config, type, true, value, score);
}

function play(
  side: Side,
  config: DemoGameConfig,
  type: string,
  isScoringPlay: boolean,
  value: number,
  score: Score,
): SummaryPlay {
  const team = config[side];
  return {
    id: `demo-${type}-${side}`,
    text: `${team.displayName} ${type.toLowerCase()}`,
    type,
    teamExternalId: String(team.id),
    period: score.period,
    clock: score.clock,
    isScoringPlay,
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
