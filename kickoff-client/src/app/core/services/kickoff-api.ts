import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { FavoriteTeam, Game, MuteType, TeamSummary } from '../models/game.model';

/**
 * All Kickoff API calls. Uses relative `/api/...` URLs — proxied to the API in
 * dev (proxy.conf.json) and served under the same origin in prod.
 */
@Injectable({ providedIn: 'root' })
export class KickoffApi {
  private readonly http = inject(HttpClient);

  getLive(): Observable<Game[]> {
    return this.http.get<Game[]>('/api/games/live');
  }

  /** Merged timeline: all games kicking off in [fromUtc, toUtc). ISO strings. */
  getRange(fromUtc: string, toUtc: string): Observable<Game[]> {
    return this.http.get<Game[]>('/api/games', { params: { from: fromUtc, to: toUtc } });
  }

  getGame(id: number): Observable<Game> {
    return this.http.get<Game>(`/api/games/${id}`);
  }

  /** Deliberate reveal: returns the score even while muted. */
  reveal(id: number): Observable<Game> {
    return this.http.get<Game>(`/api/games/${id}/reveal`);
  }

  mute(id: number, type: MuteType): Observable<void> {
    return this.http.put<void>(`/api/games/${id}/mute`, { type });
  }

  unmute(id: number): Observable<void> {
    return this.http.delete<void>(`/api/games/${id}/mute`);
  }

  markWatched(id: number): Observable<void> {
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

  // --- circled games ---

  getCircled(): Observable<Game[]> {
    return this.http.get<Game[]>('/api/games/circled');
  }

  circle(id: number, note?: string): Observable<void> {
    return this.http.put<void>(`/api/games/${id}/circle`, { note: note ?? null });
  }

  uncircle(id: number): Observable<void> {
    return this.http.delete<void>(`/api/games/${id}/circle`);
  }

  // --- teams ---

  /** Every known team for a league, with real ids -- for resolving a favorite-able
   * id against a team the client already knows about (e.g. conference pages). */
  getTeams(league: 'Nfl' | 'Ncaa'): Observable<TeamSummary[]> {
    return this.http.get<TeamSummary[]>('/api/teams', { params: { league } });
  }
}
