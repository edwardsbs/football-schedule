import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { Game } from '../../core/models/game.model';
import { isAcrossMidfield, isInFieldGoalRange, isInRedZone } from '../../core/field-position';
import { scoreEventLabel, trackScorePulse } from '../../core/score-pulse';
import { FanStore } from '../../core/services/fan-store';
import { GameDetailOverlay } from '../../core/services/game-detail-overlay';
import { TeamRecordStore } from '../../core/services/team-record-store';
import { TeamBadgeComponent } from '../../shared/team-badge/team-badge.component';
import { DayPanelSize } from './day-panel-size';

@Component({
  selector: 'app-day-game-card',
  imports: [TeamBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './day-game-card.component.html',
  styleUrl: './day-game-card.component.scss',
})
export class DayGameCardComponent {
  private static readonly LONG_PRESS_MS = 650;
  private static readonly HOLD_INTENT_MS = 150;
  private static readonly MOVE_CANCEL_DISTANCE_PX = 14;

  readonly game = input.required<Game>();
  readonly panelSize = input<DayPanelSize>('small');
  readonly gameDayState = input<'available' | 'selected' | null>(null);
  readonly detailAction = input<'overlay' | 'select'>('overlay');
  readonly gameDayToggle = output<void>();
  readonly gameSelected = output<Game>();
  private readonly scoreFeedback = trackScorePulse(this.game);
  protected readonly scorePulse = this.scoreFeedback.kind;
  protected readonly scoringSide = this.scoreFeedback.scoringSide;
  protected readonly scoreCelebration = this.scoreFeedback.celebration;
  protected readonly acrossMidfield = () => isAcrossMidfield(this.game());
  protected readonly inFieldGoalRange = () => isInFieldGoalRange(this.game());
  protected readonly inRedZone = () => isInRedZone(this.game());

  protected readonly fan = inject(FanStore);
  protected readonly records = inject(TeamRecordStore);
  private readonly detail = inject(GameDetailOverlay);
  private readonly destroyRef = inject(DestroyRef);
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private holdIntentTimer: ReturnType<typeof setTimeout> | null = null;
  private pressOrigin: { x: number; y: number } | null = null;
  private pressMoved = false;
  private longPressTriggered = false;
  protected readonly longPressArmed = signal(false);

  constructor() {
    this.destroyRef.onDestroy(() => this.clearLongPressTimer());
  }

  protected open(): void {
    const game = this.game();
    if (this.detailAction() === 'select') {
      this.gameSelected.emit(game);
      return;
    }
    this.detail.open(game.id);
  }

  protected openFromKeyboard(event: Event): void {
    event.preventDefault();
    this.open();
  }

  protected startPress(event: PointerEvent): void {
    if (!event.isPrimary || event.button !== 0) return;
    this.clearLongPressTimer();
    this.pressOrigin = { x: event.clientX, y: event.clientY };
    this.pressMoved = false;
    this.longPressTriggered = false;

    if (this.gameDayState() === null) return;
    this.holdIntentTimer = setTimeout(() => {
      this.holdIntentTimer = null;
      this.longPressArmed.set(true);
    }, DayGameCardComponent.HOLD_INTENT_MS);
    this.longPressTimer = setTimeout(() => {
      this.longPressTimer = null;
      this.longPressArmed.set(false);
      this.longPressTriggered = true;
      this.gameDayToggle.emit();
      if ('vibrate' in navigator) navigator.vibrate(18);
    }, DayGameCardComponent.LONG_PRESS_MS);
  }

  protected trackPress(event: PointerEvent): void {
    if (!this.pressOrigin || this.pressMoved) return;
    const xDistance = Math.abs(event.clientX - this.pressOrigin.x);
    const yDistance = Math.abs(event.clientY - this.pressOrigin.y);
    if (Math.max(xDistance, yDistance) < DayGameCardComponent.MOVE_CANCEL_DISTANCE_PX) return;
    this.pressMoved = true;
    this.cancelLongPress();
  }

  protected finishPress(event: PointerEvent): void {
    if (!this.pressOrigin) return;
    const openDetails = !this.pressMoved && !this.longPressTriggered && !this.longPressArmed();
    this.clearPressState();
    if (openDetails) {
      event.preventDefault();
      this.open();
    }
  }

  protected cancelPress(): void {
    this.clearPressState();
  }

  protected suppressContextMenu(event: Event): void {
    if (this.gameDayState() !== null) event.preventDefault();
  }

  protected cardAriaLabel(): string {
    const game = this.game();
    const openLabel = `Open ${game.away.displayName} at ${game.home.displayName} details`;
    if (this.gameDayState() === 'selected') return `${openLabel}. On Game Day; press and hold to remove`;
    if (this.gameDayState() === 'available') return `${openLabel}. Press and hold to add to Game Day`;
    return openLabel;
  }

  private clearPressState(): void {
    this.cancelLongPress();
    this.pressOrigin = null;
    this.pressMoved = false;
    this.longPressTriggered = false;
  }

  private cancelLongPress(): void {
    this.clearLongPressTimer();
    this.longPressArmed.set(false);
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer) clearTimeout(this.longPressTimer);
    if (this.holdIntentTimer) clearTimeout(this.holdIntentTimer);
    this.longPressTimer = null;
    this.holdIntentTimer = null;
  }

  protected statusLabel(): string {
    const game = this.game();
    const score = game.score;
    if (game.status === 'Live') {
      if (score?.period === 2 && /^0{1,2}:00$/.test(score.clock?.trim() ?? '')) return 'Halftime';
      return score?.clock ? `Q${score.period} · ${score.clock}` : 'Live';
    }
    if (game.status === 'Final') return 'Final';
    if (game.status === 'Postponed') return 'PPD';
    if (game.status === 'Canceled') return 'Off';
    return new Date(game.kickoffUtc).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  protected score(side: 'home' | 'away'): string {
    const score = this.game().score;
    if (!score || this.game().isMuted) return '—';
    return String(side === 'home' ? score.homeScore : score.awayScore);
  }

  protected possessionDirection(): 'left' | 'right' | null {
    const game = this.game();
    const possessionTeamId = game.score?.possessionTeamId;
    if (possessionTeamId === game.away.id) return 'left';
    if (possessionTeamId === game.home.id) return 'right';
    return null;
  }

  protected situationLabel(): string | null {
    return scoreEventLabel(this.scoreCelebration(), this.game().score?.downDistance)
      ?? this.game().score?.downDistance
      ?? null;
  }

  protected teamEventLabel(side: 'home' | 'away'): string | null {
    const label = this.situationLabel();
    if (!label || !this.isTeamLineSituation(label)) return null;

    const scoringSide = this.scoringSide();
    if (scoringSide) return scoringSide === side ? label : null;

    const game = this.game();
    const teamId = side === 'home' ? game.home.id : game.away.id;
    const possessionTeamId = game.score?.possessionTeamId;
    if (this.isSack(label)) {
      const defensiveTeamId = possessionTeamId === game.home.id
        ? game.away.id
        : possessionTeamId === game.away.id
          ? game.home.id
          : null;
      return defensiveTeamId === teamId ? label : null;
    }
    return possessionTeamId === teamId ? label : null;
  }

  protected fieldSituationLabel(): string | null {
    const label = this.situationLabel();
    return label && !this.isTeamLineSituation(label) ? label : null;
  }

  private isTeamLineSituation(label: string): boolean {
    return /^(?:TOUCHDOWN|FIELD GOAL|PAT(?: Good| No Good)?|2-PT Conv\.(?: Good| Failed)?|SACK|INTERCEPTION|SAFETY|4TH DOWN STOP)$/i.test(label);
  }

  private isSack(label: string): boolean {
    return /^SACK$/i.test(label);
  }

  protected isWinner(side: 'home' | 'away'): boolean {
    const game = this.game();
    const score = game.score;
    if (game.status !== 'Final' || !score) return false;
    return side === 'home' ? score.homeScore > score.awayScore : score.awayScore > score.homeScore;
  }

  protected isLoser(side: 'home' | 'away'): boolean {
    const game = this.game();
    const score = game.score;
    if (game.status !== 'Final' || !score) return false;
    return side === 'home' ? score.homeScore < score.awayScore : score.awayScore < score.homeScore;
  }
}
