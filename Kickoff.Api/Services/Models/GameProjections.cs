using Kickoff.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Kickoff.Api.Services.Models;

/// <summary>
/// The one place a <see cref="Game"/> becomes a <see cref="GameDto"/>. Score,
/// clock, win probability, and "final" status are stripped in the database
/// query for any game the requesting user has actively muted, so a hidden
/// score is never even read into memory — every read surface (live dashboard,
/// schedule, day/week, search) must project through here.
/// </summary>
public static class GameProjections
{
    /// <summary>
    /// Projects games to spoiler-safe DTOs for <paramref name="userId"/>.
    /// A game counts as muted when a <see cref="GameMute"/> row exists with
    /// <c>MuteType.Muted</c>, or <c>WatchLater</c> that has not been watched.
    /// Set <paramref name="revealMuted"/> only for a deliberate reveal gesture:
    /// scores are then shown even while <see cref="GameDto.IsMuted"/> stays true.
    /// </summary>
    public static IQueryable<GameDto> ToGameDtos(
        this IQueryable<Game> games,
        IKickoffContext db,
        int userId,
        bool revealMuted = false)
    {
        return from g in games
               join m in db.GameMutes
                   on new { GameId = g.Id, UserId = userId } equals new { m.GameId, m.UserId } into mutes
               from mute in mutes.DefaultIfEmpty()
               let muted = mute != null && (mute.MuteType == MuteType.Muted || !mute.IsWatched)
               let hideScore = muted && !revealMuted
               let started = g.Status == GameStatus.InProgress
                          || g.Status == GameStatus.Halftime
                          || g.Status == GameStatus.Final
               select new GameDto(
                   g.Id,
                   g.League,
                   new TeamSummaryDto(
                       g.HomeTeam.Id, g.HomeTeam.DisplayName, g.HomeTeam.Abbreviation,
                       g.HomeTeam.LogoUrl, g.HomeTeam.PrimaryColor, g.HomeTeam.CurrentRank, g.HomeTeam.IsFcs),
                   new TeamSummaryDto(
                       g.AwayTeam.Id, g.AwayTeam.DisplayName, g.AwayTeam.Abbreviation,
                       g.AwayTeam.LogoUrl, g.AwayTeam.PrimaryColor, g.AwayTeam.CurrentRank, g.AwayTeam.IsFcs),
                   g.KickoffUtc,
                   g.Venue != null ? g.Venue!.Name : null,
                   g.Broadcasts
                       .OrderBy(b => b.Network)
                       .Select(b => new BroadcastDto(b.Network, b.IsStreaming))
                       .ToList(),
                   // Safe status: a hidden game never resolves past "Live".
                   g.Status == GameStatus.Scheduled ? GameSafeStatus.Upcoming
                       : g.Status == GameStatus.Postponed ? GameSafeStatus.Postponed
                       : g.Status == GameStatus.Canceled ? GameSafeStatus.Canceled
                       : hideScore ? GameSafeStatus.Live
                       : g.Status == GameStatus.Final ? GameSafeStatus.Final
                       : GameSafeStatus.Live,
                   muted,
                   mute != null ? mute.MuteType : (MuteType?)null,
                   // Score block is emitted only when the game has started and
                   // is not being hidden — otherwise it is absent entirely.
                   !hideScore && started
                       ? new ScoreDto(
                           g.HomeScore ?? 0,
                           g.AwayScore ?? 0,
                           g.Period,
                           g.Clock,
                           g.PossessionTeamId,
                           g.DownDistance,
                           g.HomeWinProbability)
                       : null,
                   // Highlighting flags — a favorited team on either side, or a circled game.
                   db.UserFavoriteTeams.Any(f =>
                       f.UserId == userId && (f.TeamId == g.HomeTeamId || f.TeamId == g.AwayTeamId)),
                   db.CircledGames.Any(c => c.UserId == userId && c.GameId == g.Id),
                   g.Week.Number,
                   g.Week.Label);
    }
}
