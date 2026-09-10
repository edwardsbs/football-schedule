import { ChangeDetectionStrategy, Component, computed, effect, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TeamBadgeComponent } from '../../shared/team-badge/team-badge.component';
import { MatchLeague, MatchTile } from '../division-match/division-match-data';
import { StadiumQuestion, stadiumQuestion } from '../mini-games/stadium-game-data';

const ROUND_LENGTH = 10;

@Component({
  selector: 'app-stadium-recognition',
  imports: [RouterLink, TeamBadgeComponent],
  templateUrl: './stadium-recognition.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StadiumRecognitionComponent {
  readonly league = input.required<string>();
  readonly matchLeague = computed<MatchLeague>(() => (this.league() === 'nfl' ? 'nfl' : 'ncaa'));
  readonly leagueLabel = computed(() => this.matchLeague().toUpperCase());
  readonly roundLength = ROUND_LENGTH;
  readonly question = signal<StadiumQuestion | null>(null);
  readonly questionNumber = signal(1);
  readonly score = signal(0);
  readonly streak = signal(0);
  readonly bestStreak = signal(0);
  readonly selectedKey = signal<string | null>(null);
  readonly isComplete = signal(false);

  constructor() {
    effect(() => {
      this.matchLeague();
      untracked(() => this.newRound());
    });
  }

  newRound(): void {
    this.questionNumber.set(1);
    this.score.set(0);
    this.streak.set(0);
    this.bestStreak.set(0);
    this.selectedKey.set(null);
    this.isComplete.set(false);
    this.question.set(stadiumQuestion(this.matchLeague()));
  }

  answer(team: MatchTile): void {
    const current = this.question();
    if (!current || this.selectedKey()) return;
    this.selectedKey.set(team.key);
    if (team.key === current.stadium.team.key) {
      this.score.update((value) => value + 1);
      this.streak.update((value) => value + 1);
      this.bestStreak.update((value) => Math.max(value, this.streak()));
    } else {
      this.streak.set(0);
    }
  }

  next(): void {
    const current = this.question();
    if (!current || !this.selectedKey()) return;
    if (this.questionNumber() >= ROUND_LENGTH) {
      this.isComplete.set(true);
      return;
    }
    this.questionNumber.update((value) => value + 1);
    this.selectedKey.set(null);
    this.question.set(stadiumQuestion(this.matchLeague(), Math.random, current.stadium.name));
  }

  choiceClass(team: MatchTile): string {
    const selected = this.selectedKey();
    const correct = this.question()?.stadium.team.key;
    if (!selected) return '';
    if (team.key === correct) return 'correct';
    return team.key === selected ? 'wrong' : '';
  }
}
