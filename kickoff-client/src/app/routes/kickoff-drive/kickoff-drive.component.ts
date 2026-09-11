import { ChangeDetectionStrategy, Component, OnDestroy, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  DRIVE_PLAYS,
  DrivePlay,
  DrivePlayId,
  DrivePoint,
  DriveRoute,
  OFFENSE_STARTS,
  ReceiverId,
  advanceSeries,
  constrainCustomRoutePoint,
  customRouteFromPoints,
  distanceBetween,
  fieldGoalIsGood,
  isOutOfBounds,
  movementVector,
  passChances,
  PassOutcome,
  resolvePass,
  routePathFromPoints,
  tackleOccurs,
} from './kickoff-drive-engine';

type DrivePhase = 'ready' | 'snap' | 'routes' | 'passing' | 'catch-window' | 'running' | 'qb-running' | 'yac' | 'kick-ready' | 'kicking' | 'complete' | 'game-over';
type OffensivePositions = Record<ReceiverId | 'qb', DrivePoint>;
type CustomRoutes = Record<ReceiverId, DriveRoute | null>;

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
const blankCustomRoutes = (): CustomRoutes => ({ x: null, y: null, r: null });
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
  readonly catchProgress = signal(0);
  readonly passFeedback = signal('');
  readonly demoRunning = signal(false);
  readonly sprinting = signal(false);
  readonly stick = signal<DrivePoint>({ x: 0, y: 0 });
  readonly customRoutes = signal<CustomRoutes>(blankCustomRoutes());
  readonly editingReceiver = signal<ReceiverId | null>(null);
  readonly draftRoutePoints = signal<DrivePoint[]>([]);
  readonly routeEditMessage = signal('Tap X, Y, or R, then draw on the field');
  readonly routeHistoryDepth = signal(0);
  readonly canEditRoutes = computed(() => this.phase() === 'ready' && this.selectedPlay().kind === 'pass');
  readonly hasCustomRoutes = computed(() => Object.values(this.customRoutes()).some((route) => route !== null));
  readonly draftRoutePath = computed(() => routePathFromPoints(this.draftRoutePoints()));
  readonly clockLabel = computed(() => {
    const seconds = Math.max(0, Math.ceil(this.gameClock()));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  });
  readonly downLabel = computed(() => `${this.ordinal(this.down())} & ${this.yardsToGo()}`);
  readonly prompt = computed(() => {
    switch (this.phase()) {
      case 'ready': return this.selectedPlay().kind === 'pass'
        ? this.editingReceiver()
          ? `${this.editingReceiver()!.toUpperCase()} selected · draw the new route`
          : 'Tap a receiver to edit, or the QB to snap'
        : this.selectedPlay().kind === 'kick' ? 'Tap the QB, then swipe to kick' : 'Tap the QB to hand it off';
      case 'snap': return 'Ball live';
      case 'routes': return 'Tap an open receiver';
      case 'passing': return 'Pass in flight';
      case 'catch-window': return 'Tap CATCH now';
      case 'running': return 'Steer through the crease';
      case 'qb-running': return 'Quarterback across the line';
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
  readonly isLive = computed(() => ['snap', 'routes', 'passing', 'catch-window', 'running', 'qb-running', 'yac', 'kick-ready', 'kicking'].includes(this.phase()));

  private animationId: number | null = null;
  private resetTimerId: number | null = null;
  private demoTimerIds: number[] = [];
  private phaseStartedAt = 0;
  private lastFrameAt = 0;
  private carrier: ReceiverId | 'qb' | null = null;
  private carrierPosition: DrivePoint = { ...OFFENSE_STARTS.r };
  private passTarget: ReceiverId | null = null;
  private passOrigin: DrivePoint = { ...OFFENSE_STARTS.qb };
  private passDestination: DrivePoint = { ...OFFENSE_STARTS.y };
  private passCatchPoint: DrivePoint = { ...OFFENSE_STARTS.y };
  private passOutcome: PassOutcome = 'catchable';
  private jukeUntil = 0;
  private kickPowerValue = 0;
  private kickDrift = 0;
  private kickStart: DrivePoint | null = null;
  private routePointerId: number | null = null;
  private routeHistory: Array<{ receiver: ReceiverId; previous: DriveRoute | null }> = [];

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
    this.cancelRouteDraw();
    this.editingReceiver.set(null);
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
    this.passCatchPoint = { ...this.offense()[receiver] };
    const separation = Math.min(...this.defense().map((defender) => distanceBetween(defender, this.passCatchPoint)));
    const pocketPressure = Math.min(...this.defense().map((defender) => distanceBetween(defender, this.passOrigin)));
    const read = {
      separation,
      pocketPressure,
      depth: Math.max(0, this.passCatchPoint.x - 220),
      movement: Math.hypot(this.stick().x, this.stick().y),
    };
    const chances = passChances(read);
    const roll = Math.random();
    this.passOutcome = this.demoRunning() ? 'catchable' : resolvePass(read, roll);
    this.passFeedback.set(
      pocketPressure < 26 ? 'UNDER PRESSURE'
        : separation >= 38 ? `OPEN · ${Math.round(chances.completion * 100)}%`
          : `CONTESTED · ${Math.round(chances.completion * 100)}%`,
    );
    if (this.passOutcome === 'interception') {
      const defender = this.defense().reduce((nearest, current) =>
        distanceBetween(current, this.passCatchPoint) < distanceBetween(nearest, this.passCatchPoint) ? current : nearest,
      );
      this.passDestination = { x: defender.x, y: defender.y };
    } else if (this.passOutcome === 'incomplete') {
      this.passDestination = {
        x: this.passCatchPoint.x + 20,
        y: clamp(this.passCatchPoint.y + (roll > 0.5 ? 34 : -34), 30, 390),
      };
    } else {
      this.passDestination = { ...this.passCatchPoint };
    }
    this.phase.set('passing');
    this.ball.set({ ...this.passOrigin, visible: true, rotation: 0 });
    this.beginPhase();
  }

  isReceiverOpen(receiver: ReceiverId): boolean {
    if (this.phase() !== 'routes') return false;
    const progress = this.playProgress();
    return receiver === 'y' ? progress > 0.28 : receiver === 'x' ? progress > 0.48 : progress > 0.64;
  }

  isCatchTarget(receiver: ReceiverId): boolean {
    return this.phase() === 'catch-window' && this.passTarget === receiver;
  }

  receiverAction(receiver: ReceiverId): void {
    if (this.canEditRoutes()) this.selectRouteReceiver(receiver);
    else if (this.isCatchTarget(receiver)) this.attemptCatch();
    else this.throwTo(receiver);
  }

  selectRouteReceiver(receiver: ReceiverId): void {
    if (!this.canEditRoutes()) return;
    const changed = this.editingReceiver() !== receiver;
    this.editingReceiver.set(receiver);
    if (changed) this.routeEditMessage.set(`${receiver.toUpperCase()} selected · drag a route from the player`);
  }

  startReceiverRoute(receiver: ReceiverId, event: PointerEvent): void {
    if (!this.canEditRoutes()) return;
    event.stopPropagation();
    this.selectRouteReceiver(receiver);
    const field = (event.currentTarget as SVGGraphicsElement).ownerSVGElement;
    if (field) this.beginRouteDraw(field, event);
  }

  startRouteDraw(event: PointerEvent): void {
    const receiver = this.editingReceiver();
    if (!receiver || !this.canEditRoutes()) return;
    const target = event.target as Element | null;
    if (target?.closest('.drive-quarterback')) return;
    this.beginRouteDraw(event.currentTarget as SVGSVGElement, event);
  }

  moveRouteDraw(event: PointerEvent): void {
    if (event.pointerId !== this.routePointerId) return;
    const field = event.currentTarget as SVGSVGElement;
    const receiver = this.editingReceiver();
    if (!receiver) return;
    const next = constrainCustomRoutePoint(OFFENSE_STARTS[receiver], this.fieldPoint(field, event));
    this.draftRoutePoints.update((points) => {
      const previous = points[points.length - 1];
      return previous && distanceBetween(previous, next) < 4 ? points : [...points, next];
    });
  }

  finishRouteDraw(event: PointerEvent): void {
    if (event.pointerId !== this.routePointerId) return;
    const field = event.currentTarget as SVGSVGElement;
    const receiver = this.editingReceiver();
    if (!receiver) return;
    const endpoint = constrainCustomRoutePoint(OFFENSE_STARTS[receiver], this.fieldPoint(field, event));
    const trace = [...this.draftRoutePoints(), endpoint];
    const route = customRouteFromPoints(OFFENSE_STARTS[receiver], trace);
    if (field.hasPointerCapture(event.pointerId)) field.releasePointerCapture(event.pointerId);
    this.routePointerId = null;
    this.draftRoutePoints.set([]);

    if (!route) {
      this.routeEditMessage.set('Draw farther downfield to save the route');
      return;
    }

    this.routeHistory.push({ receiver, previous: this.customRoutes()[receiver] });
    this.routeHistoryDepth.set(this.routeHistory.length);
    this.customRoutes.update((routes) => ({ ...routes, [receiver]: route }));
    this.routeEditMessage.set(`${receiver.toUpperCase()} route saved · edit another or snap`);
  }

  cancelRouteDraw(): void {
    this.routePointerId = null;
    this.draftRoutePoints.set([]);
  }

  undoRoute(): void {
    if (!this.canEditRoutes()) return;
    const change = this.routeHistory.pop();
    if (!change) return;
    this.customRoutes.update((routes) => ({ ...routes, [change.receiver]: change.previous }));
    this.routeHistoryDepth.set(this.routeHistory.length);
    this.editingReceiver.set(change.receiver);
    this.routeEditMessage.set(`${change.receiver.toUpperCase()} route change undone`);
  }

  resetRoutes(): void {
    if (!this.canEditRoutes()) return;
    this.clearCustomRoutes();
    this.routeEditMessage.set('Original play routes restored');
  }

  attemptCatch(): void {
    if (this.phase() !== 'catch-window' || !this.passTarget) return;
    const target = this.passTarget;
    this.carrier = target;
    this.carrierPosition = { ...this.passCatchPoint };
    this.offense.update((positions) => ({ ...positions, [target]: { ...this.passCatchPoint } }));
    this.ball.update((ball) => ({ ...ball, visible: false }));
    this.passFeedback.set('CAUGHT');
    this.phase.set('yac');
    this.beginPhase();
  }

  pressJuke(): void {
    if (!this.carrier || !['running', 'qb-running', 'yac'].includes(this.phase())) return;
    const direction = Math.abs(this.stick().y) > 0.2 ? Math.sign(this.stick().y) : this.carrierPosition.y > 210 ? -1 : 1;
    this.carrierPosition.y = clamp(this.carrierPosition.y + direction * 38, 18, 402);
    this.jukeUntil = performance.now() + 650;
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
    this.demoTimerIds.push(window.setTimeout(() => this.attemptCatch(), 2_760));
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
    return this.routeFor(receiver).path;
  }

  isCustomRoute(receiver: ReceiverId): boolean {
    return this.customRoutes()[receiver] !== null;
  }

  isEditingRoute(receiver: ReceiverId): boolean {
    return this.canEditRoutes() && this.editingReceiver() === receiver;
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
      case 'routes': this.animateRoutes(elapsed, delta); break;
      case 'passing': this.animatePass(elapsed); break;
      case 'catch-window': this.animateCatchWindow(elapsed); break;
      case 'running':
      case 'qb-running':
      case 'yac': this.animateCarrier(elapsed, delta); break;
      case 'kicking': this.animateKick(elapsed); break;
    }

    if (['snap', 'routes', 'passing', 'catch-window', 'running', 'qb-running', 'yac', 'kicking'].includes(this.phase())) {
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

  private animateRoutes(elapsed: number, delta: number): void {
    const progress = clamp(elapsed / 2.75, 0, 1);
    const currentQuarterback = this.offense().qb;
    const quarterback = {
      x: clamp(currentQuarterback.x + this.stick().x * 72 * delta - (Math.abs(this.stick().x) < 0.05 ? 5 * delta : 0), 122, 228),
      y: clamp(currentQuarterback.y + this.stick().y * 96 * delta, 30, 390),
    };
    this.offense.set({
      qb: quarterback,
      x: this.routeFor('x').pointAt(progress),
      y: this.routeFor('y').pointAt(progress),
      r: this.routeFor('r').pointAt(progress),
    });
    const currentDefense = this.defense();
    this.defense.set(DEFENSE_STARTS.map((defender, index) => {
      if (index < 5) {
        return {
          ...defender,
          x: defender.x + Math.min(46, progress * 50),
          y: defender.y + Math.sin(elapsed * 1.7 + index) * 5,
        };
      }
      const current = currentDefense[index];
      const distance = Math.max(1, distanceBetween(current, quarterback));
      const rushSpeed = index === 5 ? 33 : 29;
      return {
        ...current,
        x: current.x + (quarterback.x - current.x) / distance * rushSpeed * delta,
        y: current.y + (quarterback.y - current.y) / distance * rushSpeed * delta,
      };
    }));
    this.playProgress.set(clamp(0.08 + elapsed / 5.5, 0, 0.82));
    if (quarterback.x >= 220) {
      this.carrier = 'qb';
      this.carrierPosition = { ...quarterback };
      this.phase.set('qb-running');
      this.passFeedback.set('SCRAMBLE');
      this.resetPhaseClock();
      return;
    }
    const pressure = Math.min(...this.defense().map((defender) => distanceBetween(defender, quarterback)));
    if (pressure <= 27 || elapsed >= 6.2) {
      const loss = clamp(Math.round((quarterback.x - 220) / 6), -8, -1);
      this.finishPlay(loss, 'SACKED', `Quarterback dropped for a ${Math.abs(loss)}-yard loss.`);
    }
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
    if (this.passOutcome === 'interception') {
      this.ball.update((ball) => ({ ...ball, visible: false }));
      this.turnoverResult('INTERCEPTED', 'Defender jumped the throw. New drive starts at the 25.');
      return;
    }
    if (this.passOutcome === 'incomplete') {
      this.ball.update((ball) => ({ ...ball, visible: false }));
      this.finishPlay(0, 'INCOMPLETE', 'Pass falls incomplete.');
      return;
    }
    this.ball.set({ ...this.passCatchPoint, visible: true, rotation: 0 });
    this.catchProgress.set(1);
    this.phase.set('catch-window');
    this.resetPhaseClock();
  }

  private animateCatchWindow(elapsed: number): void {
    const remaining = clamp(1 - elapsed / 0.9, 0, 1);
    this.catchProgress.set(remaining);
    if (remaining > 0) return;
    this.ball.update((ball) => ({ ...ball, visible: false }));
    this.finishPlay(0, 'INCOMPLETE', 'Catch window closed before the receiver secured it.');
  }

  private animateCarrier(elapsed: number, delta: number): void {
    if (!this.carrier) return;
    const speed = this.sprinting() ? 82 : this.phase() === 'qb-running' ? 52 : 57;
    this.carrierPosition.x += speed * delta;
    this.carrierPosition.y = clamp(this.carrierPosition.y + this.stick().y * 126 * delta, 18, 402);
    this.updateCarrierPosition();

    const defenders = this.defense();
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    defenders.forEach((defender, index) => {
      if (this.phase() === 'running' && index < 5) return;
      const distance = Math.hypot(defender.x - this.carrierPosition.x, defender.y - this.carrierPosition.y);
      if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = index; }
    });
    const nextDefense = defenders.map((defender, index) => {
      if (index !== nearestIndex) return defender;
      const distance = Math.max(1, distanceBetween(defender, this.carrierPosition));
      const pursuitSpeed = this.phase() === 'running' ? 42 : 48;
      return {
        ...defender,
        x: defender.x + (this.carrierPosition.x - defender.x) / distance * pursuitSpeed * delta,
        y: defender.y + (this.carrierPosition.y - defender.y) / distance * pursuitSpeed * delta,
      };
    });
    this.defense.set(nextDefense);

    this.playProgress.set(clamp(0.35 + elapsed / 4.2, 0, 0.98));
    const gain = Math.max(0, Math.round((this.carrierPosition.x - 220) / 6));
    if (isOutOfBounds(this.carrierPosition)) {
      this.finishPlay(gain, 'OUT OF BOUNDS', `${gain}-yard gain before stepping out.`);
      return;
    }
    const postChaseDistance = Math.min(...nextDefense.map((defender) => distanceBetween(defender, this.carrierPosition)));
    if (tackleOccurs(postChaseDistance, elapsed, performance.now() <= this.jukeUntil)) {
      this.finishPlay(gain, 'TACKLED', `${gain}-yard gain`);
      return;
    }
    if (elapsed >= (this.phase() === 'running' ? 3.15 : 1.75) || this.carrierPosition.x >= 570) {
      this.finishPlay(gain, gain >= this.yardsToGo() ? 'FIRST DOWN' : 'PLAY COMPLETE', `${gain}-yard gain`);
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

  private turnoverResult(headline: string, detail: string): void {
    this.ballOn.set(25);
    this.down.set(1);
    this.yardsToGo.set(10);
    this.completeResult(headline, detail);
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
    this.passOutcome = 'catchable';
    this.offense.set(cloneOffense());
    this.defense.set(cloneDefense());
    this.ball.set({ x: 203, y: 210, visible: false, rotation: 0 });
    this.playProgress.set(0);
    this.result.set('');
    this.resultDetail.set('');
    this.kickPower.set(0);
    this.catchProgress.set(0);
    this.passFeedback.set('');
    this.jukeUntil = 0;
    this.stick.set({ x: 0, y: 0 });
    this.sprinting.set(false);
    this.clearCustomRoutes();
    this.routeEditMessage.set('Tap X, Y, or R, then draw on the field');
    this.phase.set(this.gameClock() <= 0 ? 'game-over' : 'ready');
  }

  private beginRouteDraw(field: SVGSVGElement, event: PointerEvent): void {
    const receiver = this.editingReceiver();
    if (!receiver) return;
    event.preventDefault();
    field.setPointerCapture(event.pointerId);
    this.routePointerId = event.pointerId;
    const start = OFFENSE_STARTS[receiver];
    const pointer = constrainCustomRoutePoint(start, this.fieldPoint(field, event));
    this.draftRoutePoints.set(distanceBetween(start, pointer) >= 4 ? [{ ...start }, pointer] : [{ ...start }]);
    this.routeEditMessage.set(`Drawing ${receiver.toUpperCase()} route…`);
  }

  private fieldPoint(field: SVGSVGElement, event: PointerEvent): DrivePoint {
    const matrix = field.getScreenCTM();
    if (matrix) {
      const point = field.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const transformed = point.matrixTransform(matrix.inverse());
      return { x: transformed.x, y: transformed.y };
    }
    const rect = field.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * 760 / Math.max(1, rect.width),
      y: (event.clientY - rect.top) * 420 / Math.max(1, rect.height),
    };
  }

  private routeFor(receiver: ReceiverId): DriveRoute {
    return this.customRoutes()[receiver] ?? this.selectedPlay().routes[receiver];
  }

  private clearCustomRoutes(): void {
    this.cancelRouteDraw();
    this.customRoutes.set(blankCustomRoutes());
    this.editingReceiver.set(null);
    this.routeHistory = [];
    this.routeHistoryDepth.set(0);
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
