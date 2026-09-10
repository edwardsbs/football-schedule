import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TeamBadgeComponent } from '../../shared/team-badge/team-badge.component';
import { MatchLeague, MatchTile } from '../division-match/division-match-data';
import { LogoQuestion, logoQuestion } from '../mini-games/quiz-game-data';

const ROUND_LENGTH = 10;
const ADVANCE_DELAY_MS = 750;

@Component({
  selector: 'app-logo-blitz',
  imports: [RouterLink, TeamBadgeComponent],
  templateUrl: './logo-blitz.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoBlitzComponent {
  readonly league = input.required<string>();
  readonly matchLeague = computed<MatchLeague>(() => (this.league() === 'nfl' ? 'nfl' : 'ncaa'));
  readonly leagueLabel = computed(() => this.matchLeague().toUpperCase());
  readonly roundLength = ROUND_LENGTH;
  readonly question = signal<LogoQuestion | null>(null);
  readonly questionNumber = signal(1);
  readonly score = signal(0);
  readonly streak = signal(0);
  readonly bestStreak = signal(0);
  readonly selectedKey = signal<string | null>(null);
  readonly isComplete = signal(false);
  readonly elapsedTenths = signal(0);
  readonly elapsedLabel = computed(() => (this.elapsedTenths() / 10).toFixed(1));

  private startedAt = 0;
  private clock: ReturnType<typeof setInterval> | null = null;
  private advanceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    effect(() => {
      this.matchLeague();
      untracked(() => this.newRound());
    });
    this.destroyRef.onDestroy(() => this.stopTimers());
  }

  newRound(): void {
    this.stopTimers();
    this.questionNumber.set(1);
    this.score.set(0);
    this.streak.set(0);
    this.bestStreak.set(0);
    this.selectedKey.set(null);
    this.isComplete.set(false);
    this.elapsedTenths.set(0);
    this.question.set(logoQuestion(this.matchLeague()));
    this.startedAt = Date.now();
    this.clock = setInterval(() => this.elapsedTenths.set(Math.floor((Date.now() - this.startedAt) / 100)), 100);
  }

  answer(team: MatchTile): void {
    const current = this.question();
    if (!current || this.selectedKey()) return;
    this.selectedKey.set(team.key);
    if (team.key === current.correct.key) {
      this.score.update((value) => value + 1);
      this.streak.update((value) => value + 1);
      this.bestStreak.update((value) => Math.max(value, this.streak()));
    } else {
      this.streak.set(0);
    }
    this.advanceTimer = setTimeout(() => this.advance(), ADVANCE_DELAY_MS);
  }

  choiceClass(team: MatchTile): string {
    const selected = this.selectedKey();
    const correct = this.question()?.correct.key;
    if (!selected) return '';
    if (team.key === correct) return 'correct';
    return team.key === selected ? 'wrong' : '';
  }

  private advance(): void {
    this.advanceTimer = null;
    const current = this.question();
    if (!current) return;
    if (this.questionNumber() >= ROUND_LENGTH) {
      this.isComplete.set(true);
      if (this.clock) clearInterval(this.clock);
      this.clock = null;
      return;
    }
    this.questionNumber.update((value) => value + 1);
    this.selectedKey.set(null);
    this.question.set(logoQuestion(this.matchLeague(), Math.random, current.correct.key));
  }

  private stopTimers(): void {
    if (this.clock) clearInterval(this.clock);
    if (this.advanceTimer) clearTimeout(this.advanceTimer);
    this.clock = null;
    this.advanceTimer = null;
  }
}
