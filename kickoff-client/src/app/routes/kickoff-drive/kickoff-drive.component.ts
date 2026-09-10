import { ChangeDetectionStrategy, Component, OnDestroy, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  DRIVE_PLAYS,
  DrivePlay,
  DrivePlayId,
  DrivePoint,
  OFFENSE_STARTS,
  ReceiverId,
  advanceSeries,
  fieldGoalIsGood,
  movementVector,
} from './kickoff-drive-engine';

type DrivePhase = 'ready' | 'snap' | 'routes' | 'passing' | 'running' | 'yac' | 'kick-ready' | 'kicking' | 'complete' | 'game-over';
type OffensivePositions = Record<ReceiverId | 'qb', DrivePoint>;

interface BallState extends DrivePoint {
  visible: boolean;
  rotation: number;
}

interface Defender extends DrivePoint {
  number: number;
}

const DEFENSE_STARTS: readonly Defender[] = [
  { x: 276, y: 88, number: 1 }, { x: 276, y: 150, number: 2 },
  { x: 276, y: 208, number: 3 }, { x: 276, y: 270, number: 4 },
  { x: 276, y: 332, number: 5 }, { x: 334, y: 170, number: 6 },
  { x: 348, y: 250, number: 7 },
];

const cloneOffense = (): OffensivePositions => ({
  qb: { ...OFFENSE_STARTS.qb }, x: { ...OFFENSE_STARTS.x },
  y: { ...OFFENSE_STARTS.y }, r: { ...OFFENSE_STARTS.r },
});
const cloneDefense = (): Defender[] => DEFENSE_STARTS.map((defender) => ({ ...defender }));
const clamp = (value: number, minimum: number, maximum: number): number => Math.min(maximum, Math.max(minimum, value));

@Component({
  selector: 'app-kickoff-drive',
  imports: [RouterLink],
  templateUrl: './kickoff-drive.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KickoffDriveComponent implements OnDestroy {
  readonly plays = DRIVE_PLAYS;
  readonly yardLines = [92, 156, 220, 284, 348, 412, 476, 540, 604, 668];
  readonly hashMarks = [124, 188, 252, 316, 380, 444, 508, 572, 636];
  readonly selectedPlayId = signal<DrivePlayId>('slant');
  readonly selectedPlay = computed<DrivePlay>(() => DRIVE_PLAYS.find((play) => play.id === this.selectedPlayId())!);
  readonly phase = signal<DrivePhase>('ready');
  readonly offense = signal<OffensivePositions>(cloneOffense());
  readonly defense = signal<Defender[]>(cloneDefense());
  readonly ball = signal<BallState>({ x: 203, y: 210, visible: false, rotation: 0 });
  readonly score = signal(0);
  readonly gameClock = signal(60);
  readonly down = signal(1);
  readonly yardsToGo = signal(10);
  readonly ballOn = signal(32);
  readonly playProgress = signal(0);
  readonly result = signal('');
  readonly resultDetail = signal('');
  readonly kickPower = signal(0);
  readonly demoRunning = signal(false);
  readonly sprinting = signal(false);
  readonly stick = signal<DrivePoint>({ x: 0, y: 0 });
  readonly clockLabel = computed(() => {
    const seconds = Math.max(0, Math.ceil(this.gameClock()));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  });
  readonly downLabel = computed(() => `${this.ordinal(this.down())} & ${this.yardsToGo()}`);
  readonly prompt = computed(() => {
    switch (this.phase()) {
      case 'ready': return 'Tap the QB to snap';
      case 'snap': return 'Ball live';
      case 'routes': return 'Tap an open receiver';
      case 'passing': return 'Pass in flight';
      case 'running': return 'Steer through the crease';
      case 'yac': return 'Make a move after the catch';
      case 'kick-ready': return 'Swipe up to kick';
      case 'kicking': return 'Track the uprights';
      case 'complete': return this.resultDetail();
      case 'game-over': return 'Final whistle';
    }
  });
  readonly instruction = computed(() => {
    if (this.phase() === 'ready') return this.selectedPlay().kind === 'kick' ? 'SPECIAL TEAMS READY' : 'PLAY READY';
    if (this.phase() === 'complete') return this.result();
    if (this.phase() === 'game-over') return 'QUARTER COMPLETE';
    return 'BALL LIVE';
  });
  readonly isLive = computed(() => ['snap', 'routes', 'passing', 'running', 'yac', 'kick-ready', 'kicking'].includes(this.phase()));

  private animationId: number | null = null;
  private resetTimerId: number | null = null;
  private demoTimerIds: number[] = [];
  private phaseStartedAt = 0;
  private lastFrameAt = 0;
  private carrier: ReceiverId | null = null;
  private carrierPosition: DrivePoint = { ...OFFENSE_STARTS.r };
  private passTarget: ReceiverId | null = null;
  private passOrigin: DrivePoint = { ...OFFENSE_STARTS.qb };
  private passDestination: DrivePoint = { ...OFFENSE_STARTS.y };
  private kickPowerValue = 0;
  private kickDrift = 0;
  private kickStart: DrivePoint | null = null;

  ngOnDestroy(): void {
    this.stopAnimation();
    this.clearTimers();
  }

  selectPlay(play: DrivePlayId): void {
    if (this.isLive()) return;
    this.clearTimers();
    this.demoRunning.set(false);
    this.selectedPlayId.set(play);
    this.resetFormation();
  }

  snap(): void {
    if (this.phase() !== 'ready') return;
    this.phase.set('snap');
    this.result.set('');
    this.resultDetail.set('');
    this.ball.set({ x: 203, y: 210, visible: true, rotation: 0 });
    this.beginPhase();
  }

  throwTo(receiver: ReceiverId): void {
    if (this.phase() !== 'routes') return;
    this.passTarget = receiver;
    this.passOrigin = { ...this.offense().qb };
    this.passDestination = { ...this.offense()[receiver] };
    this.phase.set('passing');
    this.ball.set({ ...this.passOrigin, visible: true, rotation: 0 });
    this.beginPhase();
  }

  isReceiverOpen(receiver: ReceiverId): boolean {
    if (this.phase() !== 'routes') return false;
    const progress = this.playProgress();
    return receiver === 'y' ? progress > 0.28 : receiver === 'x' ? progress > 0.48 : progress > 0.64;
  }

  pressJuke(): void {
    if (!this.carrier || !['running', 'yac'].includes(this.phase())) return;
    this.carrierPosition.y = clamp(this.carrierPosition.y + (this.carrierPosition.y > 210 ? -38 : 38), 46, 374);
    this.updateCarrierPosition();
    this.resultDetail.set('Juke! Defender missed.');
  }

  setSprint(active: boolean): void {
    this.sprinting.set(active);
  }

  startStick(event: PointerEvent): void {
    const element = event.currentTarget as HTMLElement;
    element.setPointerCapture(event.pointerId);
    this.moveStick(event);
  }

  moveStick(event: PointerEvent): void {
    const element = event.currentTarget as HTMLElement;
    if (!element.hasPointerCapture(event.pointerId)) return;
    const rect = element.getBoundingClientRect();
    this.stick.set(movementVector(event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2, rect.width * 0.3));
  }

  releaseStick(): void {
    this.stick.set({ x: 0, y: 0 });
  }

  startKick(event: PointerEvent): void {
    if (this.phase() !== 'kick-ready') return;
    const element = event.currentTarget as HTMLElement;
    element.setPointerCapture(event.pointerId);
    this.kickStart = { x: event.clientX, y: event.clientY };
    this.kickPower.set(0);
  }

  moveKick(event: PointerEvent): void {
    const element = event.currentTarget as HTMLElement;
    if (!this.kickStart || !element.hasPointerCapture(event.pointerId)) return;
    const vertical = Math.max(0, this.kickStart.y - event.clientY);
    this.kickPower.set(clamp(vertical / Math.max(80, element.clientHeight), 0, 1));
  }

  releaseKick(event: PointerEvent): void {
    if (!this.kickStart || this.phase() !== 'kick-ready') return;
    const element = event.currentTarget as HTMLElement;
    const vertical = Math.max(0, this.kickStart.y - event.clientY);
    this.kickPowerValue = clamp(vertical / Math.max(80, element.clientHeight), 0.2, 1);
    this.kickDrift = clamp((event.clientX - this.kickStart.x) / Math.max(80, element.clientWidth), -1, 1);
    this.kickStart = null;
    this.kickPower.set(this.kickPowerValue);
    this.phase.set('kicking');
    this.ball.set({ x: 187, y: 210, visible: true, rotation: 0 });
    this.beginPhase();
  }

  keyboardKick(): void {
    if (this.phase() !== 'kick-ready') return;
    this.kickPowerValue = 0.82;
    this.kickDrift = 0;
    this.kickPower.set(this.kickPowerValue);
    this.phase.set('kicking');
    this.ball.set({ x: 187, y: 210, visible: true, rotation: 0 });
    this.beginPhase();
  }

  runDemo(): void {
    this.newGame();
    this.demoRunning.set(true);
    this.selectedPlayId.set('slant');
    this.demoTimerIds.push(window.setTimeout(() => this.snap(), 550));
    this.demoTimerIds.push(window.setTimeout(() => this.throwTo('y'), 2_050));
    this.demoTimerIds.push(window.setTimeout(() => this.demoRunning.set(false), 5_500));
  }

  newGame(): void {
    this.clearTimers();
    this.stopAnimation();
    this.score.set(0);
    this.gameClock.set(60);
    this.down.set(1);
    this.yardsToGo.set(10);
    this.ballOn.set(32);
    this.demoRunning.set(false);
    this.resetFormation();
  }

  routePath(receiver: ReceiverId): string {
    return this.selectedPlay().routes[receiver].path;
  }

  playerTransform(player: ReceiverId | 'qb'): string {
    const position = this.offense()[player];
    return `translate(${position.x.toFixed(1)} ${position.y.toFixed(1)})`;
  }

  defenderTransform(defender: Defender): string {
    return `translate(${defender.x.toFixed(1)} ${defender.y.toFixed(1)})`;
  }

  ballTransform(): string {
    const ball = this.ball();
    return `translate(${ball.x.toFixed(1)} ${ball.y.toFixed(1)}) rotate(${ball.rotation.toFixed(1)})`;
  }

  stickTransform(): string {
    return `translate(calc(-50% + ${this.stick().x * 24}px), calc(-50% + ${this.stick().y * 24}px))`;
  }

  fieldPositionLabel(): string {
    const yard = this.ballOn();
    return yard <= 50 ? `OWN ${yard}` : `OPP ${100 - yard}`;
  }

  private beginPhase(): void {
    this.stopAnimation();
    this.resetPhaseClock();
    this.animationId = requestAnimationFrame(this.animate);
  }

  private resetPhaseClock(): void {
    const now = performance.now();
    this.phaseStartedAt = now;
    this.lastFrameAt = now;
  }

  private readonly animate = (now: number): void => {
    const elapsed = (now - this.phaseStartedAt) / 1_000;
    const delta = Math.min(0.05, Math.max(0, (now - this.lastFrameAt) / 1_000));
    this.lastFrameAt = now;
    if (this.isLive() && this.phase() !== 'kick-ready') this.gameClock.update((seconds) => Math.max(0, seconds - delta));

    switch (this.phase()) {
      case 'snap': this.animateSnap(elapsed); break;
      case 'routes': this.animateRoutes(elapsed); break;
      case 'passing': this.animatePass(elapsed); break;
      case 'running':
      case 'yac': this.animateCarrier(elapsed, delta); break;
      case 'kicking': this.animateKick(elapsed); break;
    }

    if (['snap', 'routes', 'passing', 'running', 'yac', 'kicking'].includes(this.phase())) {
      this.animationId = requestAnimationFrame(this.animate);
    } else {
      this.animationId = null;
    }
  };

  private animateSnap(elapsed: number): void {
    const progress = clamp(elapsed / 0.22, 0, 1);
    this.ball.set({ x: 203 - 27 * progress, y: 210, visible: true, rotation: 180 * progress });
    this.playProgress.set(progress * 0.08);
    if (progress < 1) return;

    if (this.selectedPlay().kind === 'kick') {
      this.phase.set('kick-ready');
      this.ball.set({ x: 187, y: 210, visible: true, rotation: 0 });
      this.kickPower.set(0);
      return;
    }

    if (this.selectedPlay().kind === 'run') {
      this.phase.set('running');
      this.carrier = 'r';
      this.carrierPosition = { ...OFFENSE_STARTS.r };
    } else {
      this.phase.set('routes');
    }
    this.resetPhaseClock();
  }

  private animateRoutes(elapsed: number): void {
    const progress = clamp(elapsed / 2.75, 0, 1);
    const play = this.selectedPlay();
    this.offense.set({
      qb: { x: 164 - Math.min(18, progress * 21), y: 210 + Math.sin(elapsed * 8) * 1.5 },
      x: play.routes.x.pointAt(progress),
      y: play.routes.y.pointAt(progress),
      r: play.routes.r.pointAt(progress),
    });
    this.defense.set(DEFENSE_STARTS.map((defender, index) => ({
      ...defender,
      x: defender.x + Math.min(46, progress * 50),
      y: defender.y + Math.sin(elapsed * 1.7 + index) * 5,
    })));
    this.playProgress.set(clamp(0.08 + elapsed / 5.5, 0, 0.82));
    if (elapsed >= 4.8) this.finishPlay(-5, 'SACKED', 'Quarterback wrapped up for a 5-yard loss.');
  }

  private animatePass(elapsed: number): void {
    const progress = clamp(elapsed / 0.58, 0, 1);
    this.ball.set({
      x: this.passOrigin.x + (this.passDestination.x - this.passOrigin.x) * progress,
      y: this.passOrigin.y + (this.passDestination.y - this.passOrigin.y) * progress - Math.sin(progress * Math.PI) * 30,
      visible: true,
      rotation: progress * 720,
    });
    this.playProgress.set(0.5 + progress * 0.18);
    if (progress < 1 || !this.passTarget) return;
    this.carrier = this.passTarget;
    this.carrierPosition = { ...this.passDestination };
    this.ball.update((ball) => ({ ...ball, visible: false }));
    this.phase.set('yac');
    this.resetPhaseClock();
  }

  private animateCarrier(elapsed: number, delta: number): void {
    if (!this.carrier) return;
    const speed = this.sprinting() ? 82 : 57;
    this.carrierPosition.x += speed * delta;
    this.carrierPosition.y = clamp(this.carrierPosition.y + this.stick().y * 112 * delta, 46, 374);
    this.updateCarrierPosition();

    const defenders = this.defense();
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    defenders.forEach((defender, index) => {
      const distance = Math.hypot(defender.x - this.carrierPosition.x, defender.y - this.carrierPosition.y);
      if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = index; }
    });
    this.defense.set(defenders.map((defender, index) => index === nearestIndex ? {
      ...defender,
      x: defender.x + (this.carrierPosition.x - defender.x) * delta * 1.2,
      y: defender.y + (this.carrierPosition.y - defender.y) * delta * 1.2,
    } : defender));

    this.playProgress.set(clamp(0.35 + elapsed / 4.2, 0, 0.98));
    const startX = this.phase() === 'running' ? OFFENSE_STARTS.r.x : this.passDestination.x;
    const gain = Math.max(this.phase() === 'running' ? 0 : Math.round((this.passDestination.x - 220) / 6), Math.round((this.carrierPosition.x - startX) / 6));
    if (elapsed >= (this.phase() === 'running' ? 3.15 : 1.75) || this.carrierPosition.x >= 570) {
      this.finishPlay(Math.max(1, gain), gain >= this.yardsToGo() ? 'FIRST DOWN' : 'PLAY COMPLETE', `${Math.max(1, gain)}-yard gain`);
    }
  }

  private animateKick(elapsed: number): void {
    const progress = clamp(elapsed / 1.08, 0, 1);
    const destinationX = 187 + 520 * this.kickPowerValue;
    this.ball.set({
      x: 187 + (destinationX - 187) * progress,
      y: 210 + this.kickDrift * 95 * progress - Math.sin(progress * Math.PI) * 96,
      visible: true,
      rotation: progress * 900,
    });
    this.playProgress.set(progress);
    if (progress < 1) return;

    const good = fieldGoalIsGood(this.kickPowerValue, this.kickDrift);
    this.ball.update((ball) => ({ ...ball, visible: false }));
    if (good) this.score.update((score) => score + 3);
    this.completeResult(good ? 'FIELD GOAL' : 'NO GOOD', good ? 'Kick is good! +3 points' : this.kickPowerValue < 0.58 ? 'The kick falls short.' : 'The kick sails wide.');
  }

  private finishPlay(gain: number, headline: string, detail: string): void {
    const outcome = advanceSeries({ ballOn: this.ballOn(), down: this.down(), yardsToGo: this.yardsToGo() }, gain);
    if (outcome.touchdown) {
      this.score.update((score) => score + 7);
      this.completeResult('TOUCHDOWN', 'Drive complete! +7 points');
      this.ballOn.set(25); this.down.set(1); this.yardsToGo.set(10);
      return;
    }
    if (outcome.turnover) {
      this.ballOn.set(25); this.down.set(1); this.yardsToGo.set(10);
      this.completeResult('TURNOVER ON DOWNS', 'New drive begins at the 25.');
      return;
    }
    this.ballOn.set(outcome.ballOn);
    this.down.set(outcome.down);
    this.yardsToGo.set(outcome.yardsToGo);
    this.completeResult(outcome.firstDown ? 'FIRST DOWN' : headline, detail);
  }

  private completeResult(headline: string, detail: string): void {
    this.stopAnimation();
    this.phase.set(this.gameClock() <= 0 ? 'game-over' : 'complete');
    this.result.set(headline);
    this.resultDetail.set(detail);
    this.playProgress.set(1);
    this.resetTimerId = window.setTimeout(() => {
      if (this.gameClock() <= 0) this.phase.set('game-over');
      else this.resetFormation();
    }, 1_850);
  }

  private updateCarrierPosition(): void {
    if (!this.carrier) return;
    this.offense.update((positions) => ({ ...positions, [this.carrier!]: { ...this.carrierPosition } }));
  }

  private resetFormation(): void {
    this.stopAnimation();
    this.carrier = null;
    this.passTarget = null;
    this.offense.set(cloneOffense());
    this.defense.set(cloneDefense());
    this.ball.set({ x: 203, y: 210, visible: false, rotation: 0 });
    this.playProgress.set(0);
    this.result.set('');
    this.resultDetail.set('');
    this.kickPower.set(0);
    this.stick.set({ x: 0, y: 0 });
    this.sprinting.set(false);
    this.phase.set(this.gameClock() <= 0 ? 'game-over' : 'ready');
  }

  private stopAnimation(): void {
    if (this.animationId === null) return;
    cancelAnimationFrame(this.animationId);
    this.animationId = null;
  }

  private clearTimers(): void {
    if (this.resetTimerId !== null) window.clearTimeout(this.resetTimerId);
    this.resetTimerId = null;
    this.demoTimerIds.forEach((id) => window.clearTimeout(id));
    this.demoTimerIds = [];
  }

  private ordinal(down: number): string {
    return down === 1 ? '1ST' : down === 2 ? '2ND' : down === 3 ? '3RD' : '4TH';
  }
}
