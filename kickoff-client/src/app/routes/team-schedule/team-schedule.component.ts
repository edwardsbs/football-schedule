import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { groupByWeek } from '../../core/timeline';
import { FanStore } from '../../core/services/fan-store';
import { KickoffApi } from '../../core/services/kickoff-api';
import { LiveGameStore } from '../../core/services/live-game-store';
import { TeamRecordStore } from '../../core/services/team-record-store';
import { GameRowComponent } from '../../shared/game-row/game-row.component';
import { TeamBadgeComponent } from '../../shared/team-badge/team-badge.component';

@Component({
  selector: 'app-team-schedule',
  imports: [DatePipe, GameRowComponent, RouterLink, TeamBadgeComponent],
  templateUrl: './team-schedule.component.html',
  styleUrls: ['../shared/timeline.scss', './team-schedule.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamScheduleComponent {
  private readonly api = inject(KickoffApi);
  private readonly live = inject(LiveGameStore);
  protected readonly records = inject(TeamRecordStore);
  protected readonly fan = inject(FanStore);
  private readonly reload = signal(0);

  readonly id = input.required<string>();
  private readonly request = computed(() => ({
    teamId: Number(this.id()),
    reload: this.reload(),
  }));

  readonly schedule = toSignal(
    toObservable(this.request).pipe(
      switchMap(({ teamId }) => Number.isInteger(teamId) && teamId > 0
        ? this.api.getTeamSchedule(teamId).pipe(catchError(() => of(null)))
        : of(null)),
    ),
  );

  readonly games = computed(() => this.live.overlayAll(this.schedule()?.games ?? []));
  readonly weeks = computed(() => groupByWeek(this.games()));

  protected refresh(): void {
    this.reload.update((value) => value + 1);
  }

  protected toggleFavorite(): void {
    const team = this.schedule()?.team;
    if (team) this.fan.toggleFavorite(team.id);
  }

  protected toggleInterest(): void {
    const team = this.schedule()?.team;
    if (team) this.fan.toggleInterest(team.id);
  }
}
