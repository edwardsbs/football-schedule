import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { KickoffApi } from './kickoff-api';
import { TeamRecordStore } from './team-record-store';

describe('TeamRecordStore', () => {
  it('loads both leagues into one compact W/L/T lookup', fakeAsync(() => {
    const api = jasmine.createSpyObj<KickoffApi>('KickoffApi', ['getTeamRecords']);
    api.getTeamRecords.and.callFake((league) => of(
      league === 'Nfl'
        ? [{ teamId: 1, wins: 1, losses: 0, ties: 0 }]
        : [{ teamId: 2, wins: 0, losses: 1, ties: 0 }],
    ));
    TestBed.configureTestingModule({
      providers: [TeamRecordStore, { provide: KickoffApi, useValue: api }],
    });

    const store = TestBed.inject(TeamRecordStore);
    tick(0);

    expect(store.label(1)).toBe('1–0–0');
    expect(store.label(2)).toBe('0–1–0');
    expect(api.getTeamRecords).toHaveBeenCalledWith('Nfl');
    expect(api.getTeamRecords).toHaveBeenCalledWith('Ncaa');
  }));
});
