import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RECEIVER_ROUTES, ReceiverRoute } from '../../core/data/receiver-routes.data';
import { RouteQuestion, routeQuestion } from '../mini-games/quiz-game-data';

type RouteMode = 'core' | 'full';
const ROUND_LENGTH = 10;

@Component({
  selector: 'app-route-recognition',
  imports: [RouterLink],
  templateUrl: './route-recognition.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RouteRecognitionComponent {
  readonly roundLength = ROUND_LENGTH;
  readonly yardLines = [72, 117, 162, 207, 252, 297];
  readonly mode = signal<RouteMode>('core');
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

  constructor() {
    this.newRound('core');
  }

  newRound(mode: RouteMode = this.mode()): void {
    this.mode.set(mode);
    this.questionNumber.set(1);
    this.score.set(0);
    this.streak.set(0);
    this.bestStreak.set(0);
    this.selectedNumber.set(null);
    this.isComplete.set(false);
    this.question.set(routeQuestion(this.pool()));
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
    if (this.questionNumber() >= ROUND_LENGTH) {
      this.isComplete.set(true);
      return;
    }
    this.questionNumber.update((value) => value + 1);
    this.selectedNumber.set(null);
    this.question.set(routeQuestion(this.pool(), Math.random, current.correct.number));
  }

  choiceClass(route: ReceiverRoute): string {
    const selected = this.selectedNumber();
    const correct = this.question()?.correct.number;
    if (selected === null) return '';
    if (route.number === correct) return 'correct';
    return route.number === selected ? 'wrong' : '';
  }
}
