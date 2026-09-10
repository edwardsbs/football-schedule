import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RECEIVER_ROUTES, ReceiverRoute } from '../../core/data/receiver-routes.data';
import { RouteQuestion, coreRouteRound, mixedRouteRound, routeQuestionFor } from '../mini-games/quiz-game-data';

type RouteMode = 'core' | 'full';

@Component({
  selector: 'app-route-recognition',
  imports: [RouterLink],
  templateUrl: './route-recognition.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RouteRecognitionComponent {
  readonly yardLines = [72, 117, 162, 207, 252, 297];
  readonly mode = signal<RouteMode>('full');
  readonly round = signal<ReceiverRoute[]>([]);
  readonly roundLength = computed(() => this.round().length);
  readonly question = signal<RouteQuestion | null>(null);
  readonly questionNumber = signal(1);
  readonly score = signal(0);
  readonly streak = signal(0);
  readonly bestStreak = signal(0);
  readonly selectedNumber = signal<number | string | null>(null);
  readonly isComplete = signal(false);
  readonly pool = computed(() => this.mode() === 'core'
    ? RECEIVER_ROUTES.filter((route) => route.group === 'Core tree')
    : RECEIVER_ROUTES);
  readonly roundSectionLabel = computed(() => {
    if (this.mode() === 'core' || this.questionNumber() <= 5) return 'Route tree';
    if (this.questionNumber() <= 9) return 'Advanced routes';
    return 'Combination concepts';
  });

  constructor() {
    this.newRound('full');
  }

  newRound(mode: RouteMode = this.mode()): void {
    this.mode.set(mode);
    this.questionNumber.set(1);
    this.score.set(0);
    this.streak.set(0);
    this.bestStreak.set(0);
    this.selectedNumber.set(null);
    this.isComplete.set(false);
    const round = mode === 'core'
      ? coreRouteRound(RECEIVER_ROUTES)
      : mixedRouteRound(RECEIVER_ROUTES);
    this.round.set(round);
    this.question.set(routeQuestionFor(round[0], this.pool()));
  }

  answer(route: ReceiverRoute): void {
    const current = this.question();
    if (!current || this.selectedNumber() !== null) return;
    this.selectedNumber.set(route.number);
    if (route.number === current.correct.number) {
      this.score.update((value) => value + 1);
      this.streak.update((value) => value + 1);
      this.bestStreak.update((value) => Math.max(value, this.streak()));
    } else {
      this.streak.set(0);
    }
  }

  next(): void {
    const current = this.question();
    if (!current || this.selectedNumber() === null) return;
    if (this.questionNumber() >= this.roundLength()) {
      this.isComplete.set(true);
      return;
    }
    const nextIndex = this.questionNumber();
    this.questionNumber.set(nextIndex + 1);
    this.selectedNumber.set(null);
    this.question.set(routeQuestionFor(this.round()[nextIndex], this.pool()));
  }

  choiceClass(route: ReceiverRoute): string {
    const selected = this.selectedNumber();
    const correct = this.question()?.correct.number;
    if (selected === null) return '';
    if (route.number === correct) return 'correct';
    return route.number === selected ? 'wrong' : '';
  }
}
