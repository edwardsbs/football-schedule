export type DrivePlayId = 'slant' | 'zone' | 'verticals' | 'fieldgoal';
export type DrivePlayKind = 'pass' | 'run' | 'kick';
export type ReceiverId = 'x' | 'y' | 'r';
export type PassOutcome = 'catchable' | 'incomplete' | 'interception';

export interface DrivePoint {
  x: number;
  y: number;
}

export interface DriveRoute {
  path: string;
  pointAt(progress: number): DrivePoint;
}

export interface DrivePlay {
  id: DrivePlayId;
  name: string;
  note: string;
  kind: DrivePlayKind;
  routes: Record<ReceiverId, DriveRoute>;
}

export interface SeriesState {
  ballOn: number;
  down: number;
  yardsToGo: number;
}

export interface SeriesResult extends SeriesState {
  firstDown: boolean;
  touchdown: boolean;
  turnover: boolean;
}

export interface PassRead {
  separation: number;
  pocketPressure: number;
  depth: number;
  movement: number;
}

export interface PassChances {
  completion: number;
  interception: number;
}

export const OFFENSE_STARTS: Record<ReceiverId | 'qb', DrivePoint> = {
  qb: { x: 164, y: 210 },
  x: { x: 202, y: 88 },
  y: { x: 202, y: 150 },
  r: { x: 174, y: 270 },
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const point = (x: number, y: number): DrivePoint => ({ x, y });

export const DRIVE_PLAYS: readonly DrivePlay[] = [
  {
    id: 'slant',
    name: 'Slant / Flat',
    note: 'Quick pass · 3 targets',
    kind: 'pass',
    routes: {
      x: {
        path: 'M202 88 C245 88 264 96 310 132 L344 158',
        pointAt: (raw) => {
          const t = clamp01(raw);
          return point(202 + 142 * t, 88 + 70 * Math.pow(t, 1.7));
        },
      },
      y: {
        path: 'M202 150 C252 150 270 142 304 112',
        pointAt: (raw) => {
          const t = clamp01(raw);
          return point(202 + 102 * t, 150 - 38 * Math.pow(t, 1.4));
        },
      },
      r: {
        path: 'M174 270 C202 286 232 288 268 268',
        pointAt: (raw) => {
          const t = clamp01(raw);
          return point(174 + 94 * t, 270 + 13 * Math.sin(t * Math.PI));
        },
      },
    },
  },
  {
    id: 'zone',
    name: 'Inside Zone',
    note: 'Read the first crease',
    kind: 'run',
    routes: {
      x: { path: 'M202 88 L238 88', pointAt: (t) => point(202 + 36 * clamp01(t), 88) },
      y: { path: 'M202 150 L238 150', pointAt: (t) => point(202 + 36 * clamp01(t), 150) },
      r: {
        path: 'M174 270 C200 250 214 230 252 214 L304 214',
        pointAt: (raw) => {
          const t = clamp01(raw);
          return point(174 + 130 * t, 270 - 56 * Math.sin(Math.min(1, t * 1.25) * Math.PI / 2));
        },
      },
    },
  },
  {
    id: 'verticals',
    name: 'Four Verticals',
    note: 'Stretch the secondary',
    kind: 'pass',
    routes: {
      x: { path: 'M202 88 C300 88 406 88 548 88', pointAt: (t) => point(202 + 345 * clamp01(t), 88) },
      y: {
        path: 'M202 150 C312 150 424 145 556 126',
        pointAt: (raw) => {
          const t = clamp01(raw);
          return point(202 + 350 * t, 150 - 23 * t * t);
        },
      },
      r: {
        path: 'M174 270 C236 270 300 286 374 312',
        pointAt: (raw) => {
          const t = clamp01(raw);
          return point(174 + 200 * t, 270 + 42 * t);
        },
      },
    },
  },
  {
    id: 'fieldgoal',
    name: 'Field Goal',
    note: 'Swipe for power',
    kind: 'kick',
    routes: {
      x: { path: 'M202 88 L224 88', pointAt: (t) => point(202 + 22 * clamp01(t), 88) },
      y: { path: 'M202 150 L224 150', pointAt: (t) => point(202 + 22 * clamp01(t), 150) },
      r: { path: 'M174 270 L190 250', pointAt: (t) => point(174 + 16 * clamp01(t), 270 - 20 * clamp01(t)) },
    },
  },
];

export function movementVector(dx: number, dy: number, radius: number): DrivePoint {
  if (radius <= 0) return point(0, 0);
  const magnitude = Math.hypot(dx, dy);
  if (magnitude === 0) return point(0, 0);
  const scale = magnitude > radius ? radius / magnitude : 1;
  return point((dx * scale) / radius, (dy * scale) / radius);
}

export function advanceSeries(state: SeriesState, gain: number): SeriesResult {
  const wholeGain = Math.trunc(gain);
  const ballOn = Math.max(1, Math.min(100, state.ballOn + wholeGain));
  const touchdown = ballOn >= 100;
  const firstDown = !touchdown && wholeGain >= state.yardsToGo;
  const nextDown = firstDown ? 1 : state.down + 1;
  const turnover = !touchdown && nextDown > 4;

  return {
    ballOn,
    down: turnover ? 1 : nextDown,
    yardsToGo: firstDown ? Math.min(10, 100 - ballOn) : Math.max(1, state.yardsToGo - wholeGain),
    firstDown,
    touchdown,
    turnover,
  };
}

export function fieldGoalIsGood(power: number, horizontalDrift: number): boolean {
  return power >= 0.58 && Math.abs(horizontalDrift) <= 0.55;
}

export function distanceBetween(a: DrivePoint, b: DrivePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function isOutOfBounds(position: DrivePoint): boolean {
  return position.y <= 28 || position.y >= 392;
}

export function tackleOccurs(separation: number, secondsSinceCarry: number, jukeProtected: boolean): boolean {
  return !jukeProtected && secondsSinceCarry > 0.42 && separation <= 28;
}

export function passChances(read: PassRead): PassChances {
  const pressurePenalty = Math.max(0, 34 - read.pocketPressure) / 90;
  const separationBonus = Math.min(0.22, Math.max(-0.18, (read.separation - 28) / 120));
  const depthPenalty = Math.max(0, read.depth - 32) / 190;
  const movementPenalty = Math.min(1, Math.max(0, read.movement)) * 0.14;
  const completion = Math.min(0.95, Math.max(0.28, 0.74 + separationBonus - pressurePenalty - depthPenalty - movementPenalty));
  const interception = Math.min(0.26, Math.max(0.025,
    0.035 + Math.max(0, 24 - read.separation) / 105 + Math.max(0, 22 - read.pocketPressure) / 125 + depthPenalty * 0.28,
  ));
  return { completion, interception };
}

export function resolvePass(read: PassRead, randomValue: number): PassOutcome {
  const chances = passChances(read);
  const roll = Math.min(0.999_999, Math.max(0, randomValue));
  if (roll < chances.interception) return 'interception';
  if (roll < chances.interception + chances.completion * (1 - chances.interception)) return 'catchable';
  return 'incomplete';
}
