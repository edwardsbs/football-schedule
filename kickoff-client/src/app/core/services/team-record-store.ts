import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of, switchMap, timer } from 'rxjs';
import { TeamRecord } from '../models/game.model';
import { KickoffApi } from './kickoff-api';

/**
 * One app-wide, live record cache. Matchup-heavy pages can all show the same
 * W/L/T value without each component starting its own polling loop.
 */
@Injectable({ providedIn: 'root' })
export class TeamRecordStore {
  private readonly api = inject(KickoffApi);
  private readonly byTeamId = signal(new Map<number, TeamRecord>());

  constructor() {
    timer(0, 30_000)
      .pipe(
        switchMap(() =>
          forkJoin({
            nfl: this.api.getTeamRecords('Nfl').pipe(catchError(() => of(null))),
            ncaa: this.api.getTeamRecords('Ncaa').pipe(catchError(() => of(null))),
          }),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ nfl, ncaa }) => {
        // A failed refresh retains the last good values for that league.
        this.byTeamId.update((current) => {
          const next = new Map(current);
          for (const record of nfl ?? []) next.set(record.teamId, record);
          for (const record of ncaa ?? []) next.set(record.teamId, record);
          return next;
        });
      });
  }

  record(teamId: number): TeamRecord | null {
    return this.byTeamId().get(teamId) ?? null;
  }

  label(teamId: number): string {
    const record = this.record(teamId);
    return record ? `${record.wins}–${record.losses}–${record.ties}` : '—–—–—';
  }

  ariaLabel(teamId: number): string {
    const record = this.record(teamId);
    return record
      ? `${record.wins} wins, ${record.losses} losses, ${record.ties} ties`
      : 'Record loading';
  }
}
