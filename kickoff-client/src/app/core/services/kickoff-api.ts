import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { FavoriteTeam, Game, MuteType, TeamInterest, TeamRecord, TeamSummary } from '../models/game.model';
import { GameSummary } from '../models/game-summary.model';
import { NcaaRankings } from '../models/ranking.model';
import { DemoGameStore } from './demo-game-store';

/**
 * All Kickoff API calls. Uses relative `/api/...` URLs — proxied to the API in
 * dev (proxy.conf.json) and served under the same origin in prod.
 */
@Injectable({ providedIn: 'root' })
export class KickoffApi {
  private readonly http = inject(HttpClient);
  private readonly demo = inject(DemoGameStore);

  getLive(): Observable<Game[]> {
    return this.http.get<Game[]>('/api/games/live');
  }

  /** Merged timeline: all games kicking off in [fromUtc, toUtc). ISO strings.
   * Pass `league` to restrict to one league's slice (the season-by-week view). */
  getRange(fromUtc: string, toUtc: string, league?: 'Nfl' | 'Ncaa'): Observable<Game[]> {
    const params: Record<string, string> = { from: fromUtc, to: toUtc };
    if (league) params['league'] = league;
    return this.http.get<Game[]>('/api/games', { params });
  }

  getGame(id: number): Observable<Game> {
    const demoGame = this.demo.game(id);
    if (demoGame) return of(demoGame);
    return this.http.get<Game>(`/api/games/${id}`);
  }

  /** Rich per-game context. Returns null when unavailable or spoiler-muted. */
  getGameSummary(id: number): Observable<GameSummary | null> {
    if (this.demo.isDemoGame(id)) return of(this.demo.summary(id));
    return this.http.get<GameSummary | null>(`/api/games/${id}/summary`);
  }

  /** Deliberate reveal: returns the score even while muted. */
  reveal(id: number): Observable<Game> {
    const demoGame = this.demo.game(id);
    if (demoGame) return of(demoGame);
    return this.http.get<Game>(`/api/games/${id}/reveal`);
  }

  mute(id: number, type: MuteType): Observable<void> {
    if (this.demo.setMuted(id, true)) return of(void 0);
    return this.http.put<void>(`/api/games/${id}/mute`, { type });
  }

  unmute(id: number): Observable<void> {
    if (this.demo.setMuted(id, false)) return of(void 0);
    return this.http.delete<void>(`/api/games/${id}/mute`);
  }

  markWatched(id: number): Observable<void> {
    if (this.demo.isDemoGame(id)) return of(void 0);
    return this.http.post<void>(`/api/games/${id}/watched`, {});
  }

  // --- favorites ---

  getFavorites(): Observable<FavoriteTeam[]> {
    return this.http.get<FavoriteTeam[]>('/api/favorites/teams');
  }

  addFavorite(teamId: number): Observable<void> {
    return this.http.put<void>(`/api/favorites/teams/${teamId}`, {});
  }

  removeFavorite(teamId: number): Observable<void> {
    return this.http.delete<void>(`/api/favorites/teams/${teamId}`);
  }

  // --- teams of interest ---

  getTeamInterests(): Observable<TeamInterest[]> {
    return this.http.get<TeamInterest[]>('/api/team-interests');
  }

  addTeamInterest(teamId: number): Observable<void> {
    return this.http.put<void>(`/api/team-interests/${teamId}`, {});
  }

  removeTeamInterest(teamId: number): Observable<void> {
    return this.http.delete<void>(`/api/team-interests/${teamId}`);
  }

  // --- circled games ---

  getCircled(): Observable<Game[]> {
    return this.http.get<Game[]>('/api/games/circled');
  }

  circle(id: number, note?: string): Observable<void> {
    if (this.demo.isDemoGame(id)) return of(void 0);
    return this.http.put<void>(`/api/games/${id}/circle`, { note: note ?? null });
  }

  uncircle(id: number): Observable<void> {
    if (this.demo.isDemoGame(id)) return of(void 0);
    return this.http.delete<void>(`/api/games/${id}/circle`);
  }

  // --- teams ---

  /** Every known team for a league, with real ids -- for resolving a favorite-able
   * id against a team the client already knows about (e.g. conference pages). */
  getTeams(league: 'Nfl' | 'Ncaa'): Observable<TeamSummary[]> {
    return this.http.get<TeamSummary[]>('/api/teams', { params: { league } });
  }

  /** Overall W/L/T records from completed games in the active football season. */
  getTeamRecords(league: 'Nfl' | 'Ncaa'): Observable<TeamRecord[]> {
    return this.http.get<TeamRecord[]>('/api/teams/records', { params: { league } });
  }

  /** AP and, once available, CFP poll snapshots for an NCAA season week. */
  getNcaaRankings(seasonYear: number, week: number): Observable<NcaaRankings> {
    return this.http.get<NcaaRankings>('/api/rankings/ncaa', {
      params: { seasonYear, week },
    });
  }

  /** Current AP and CFP polls for the conference ranking rail. */
  getCurrentNcaaRankings(): Observable<NcaaRankings> {
    return this.http.get<NcaaRankings>('/api/rankings/ncaa/current');
  }
}
