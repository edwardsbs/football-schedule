import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { FavoriteTeam, Game, MuteType, TeamRecord, TeamSummary } from '../models/game.model';
import { GameSummary } from '../models/game-summary.model';
import { RankingPoll } from '../models/ranking.model';

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

  /** Merged timeline: all games kicking off in [fromUtc, toUtc). ISO strings.
   * Pass `league` to restrict to one league's slice (the season-by-week view). */
  getRange(fromUtc: string, toUtc: string, league?: 'Nfl' | 'Ncaa'): Observable<Game[]> {
    const params: Record<string, string> = { from: fromUtc, to: toUtc };
    if (league) params['league'] = league;
    return this.http.get<Game[]>('/api/games', { params });
  }

  getGame(id: number): Observable<Game> {
    return this.http.get<Game>(`/api/games/${id}`);
  }

  /** Rich per-game context. Returns null when unavailable or spoiler-muted. */
  getGameSummary(id: number): Observable<GameSummary | null> {
    return this.http.get<GameSummary | null>(`/api/games/${id}/summary`);
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

  /** Overall W/L/T records from completed games in the active football season. */
  getTeamRecords(league: 'Nfl' | 'Ncaa'): Observable<TeamRecord[]> {
    return this.http.get<TeamRecord[]>('/api/teams/records', { params: { league } });
  }

  /** AP poll snapshot that applied to an NCAA season week. */
  getNcaaRankings(seasonYear: number, week: number): Observable<RankingPoll> {
    return this.http.get<RankingPoll>('/api/rankings/ncaa', {
      params: { seasonYear, week },
    });
  }
}
