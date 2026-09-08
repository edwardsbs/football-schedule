using Kickoff.Api.Domain;
using Kickoff.Api.Integrations.SportsData.Contracts;
using Microsoft.EntityFrameworkCore;

namespace Kickoff.Api.Services.Sync;

public record ScheduleImportResult(int TeamsAdded, int GamesAdded, int GamesUpdated);
public record TeamImportResult(int TeamsAdded, int TeamsUpdated);

/// <summary>
/// Upserts a <see cref="ScheduleFeed"/> into the domain, keyed by external id so
/// re-imports are idempotent. Creates the Season/Week on demand. Conference and
/// division linking is intentionally left for a later pass (teams import with
/// null Conference/Division for now).
/// </summary>
public class ScheduleImportService(IKickoffContext db, TimeProvider? timeProvider = null)
{
    private readonly TimeProvider _time = timeProvider ?? TimeProvider.System;

    public async Task<ScheduleImportResult> ImportAsync(ScheduleFeed feed, CancellationToken ct = default)
    {
        var season = await GetOrCreateSeasonAsync(feed.League, feed.SeasonYear, ct);
        var week = await GetOrCreateWeekAsync(season, feed, ct);

        var feedTeams = feed.Games
            .SelectMany(g => new[] { g.Home, g.Away })
            .GroupBy(t => t.ExternalId)
            .Select(grp => grp.First())
            .ToList();
        var (teamsAdded, _) = await UpsertTeamsAsync(feed.League, feedTeams, ct);

        // Existing games for this feed, by external id -- scoped to this feed's
        // league, since a provider's external ids aren't necessarily unique
        // across leagues (verified: ESPN's aren't, for teams at least).
        var externalIds = feed.Games.Select(g => g.ExternalId).ToList();
        var existingGames = await db.Games
            .Include(g => g.Broadcasts)
            .Where(g => g.League == feed.League && g.ExternalId != null && externalIds.Contains(g.ExternalId))
            .ToListAsync(ct);
        var gamesByExt = existingGames.ToDictionary(g => g.ExternalId!);

        var teamsByExt = await db.Teams
            .Where(t => t.League == feed.League && t.ExternalId != null)
            .ToDictionaryAsync(t => t.ExternalId!, ct);

        int added = 0, updated = 0;
        foreach (var fg in feed.Games)
        {
            if (!teamsByExt.TryGetValue(fg.Home.ExternalId, out var home) ||
                !teamsByExt.TryGetValue(fg.Away.ExternalId, out var away))
            {
                continue; // team upsert above should have created these
            }

            if (!gamesByExt.TryGetValue(fg.ExternalId, out var game))
            {
                game = new Game { ExternalId = fg.ExternalId };
                db.Games.Add(game);
                added++;
            }
            else
            {
                updated++;
            }

            game.WeekId = week.Id;
            game.League = feed.League;
            game.HomeTeamId = home.Id;
            game.AwayTeamId = away.Id;
            game.KickoffUtc = fg.KickoffUtc;
            ApplyScore(game, fg.Status, fg.Score, teamsByExt);
            SyncBroadcasts(game, fg.Broadcasts);
        }

        await db.SaveChangesAsync(ct);
        return new ScheduleImportResult(teamsAdded, added, updated);
    }

    /// <summary>
    /// Upserts a full team roster, independent of any schedule feed -- used both
    /// by a schedule import (teams referenced by that week's games) and by
    /// <see cref="ImportTeamsAsync"/> (a league's entire roster, so every team
    /// has a real id to favorite even before it appears in an imported game).
    /// </summary>
    public Task<TeamImportResult> ImportTeamsAsync(
        League league, IReadOnlyList<FeedTeam> feedTeams, CancellationToken ct = default) =>
        UpsertTeamsAsync(league, feedTeams, ct);

    private async Task<TeamImportResult> UpsertTeamsAsync(
        League league,
        IReadOnlyList<FeedTeam> feedTeams,
        CancellationToken ct)
    {
        var ids = feedTeams.Select(t => t.ExternalId).ToList();
        var existing = await db.Teams
            .Where(t => t.League == league && t.ExternalId != null && ids.Contains(t.ExternalId))
            .ToDictionaryAsync(t => t.ExternalId!, ct);

        int added = 0, updated = 0;
        foreach (var ft in feedTeams)
        {
            if (existing.TryGetValue(ft.ExternalId, out var team))
            {
                team.DisplayName = ft.DisplayName;
                team.Abbreviation = ft.Abbreviation;
                if (ft.LogoUrl is not null) team.LogoUrl = ft.LogoUrl;
                if (ft.IsFcs is not null) team.IsFcs = ft.IsFcs.Value;
                updated++;
                continue;
            }

            db.Teams.Add(new Team
            {
                League = league,
                ExternalId = ft.ExternalId,
                Location = ft.Location,
                Name = ft.Name,
                DisplayName = ft.DisplayName,
                Abbreviation = ft.Abbreviation,
                LogoUrl = ft.LogoUrl,
                IsFcs = ft.IsFcs ?? false,
            });
            added++;
        }

        await db.SaveChangesAsync(ct); // assign team ids before wiring games
        return new TeamImportResult(added, updated);
    }

    private void ApplyScore(
        Game game,
        GameStatus status,
        ScoreSnapshot? score,
        IReadOnlyDictionary<string, Team> teamsByExternalId)
    {
        var previous = ScoreboardState.Capture(game);
        game.Status = status;

        if (score is null)
        {
            game.HomeScore = game.AwayScore = null;
            game.Period = null;
            game.Clock = null;
            if (game.Status is not (GameStatus.InProgress or GameStatus.Halftime))
            {
                game.PossessionTeamId = null;
                game.DownDistance = null;
            }
            game.HomeWinProbability = null;
            if (previous != ScoreboardState.Capture(game))
                game.LastUpdatedUtc = _time.GetUtcNow();
            return;
        }

        var homeIncrease = game.HomeScore is { } oldHome ? score.HomeScore - oldHome : 0;
        var awayIncrease = game.AwayScore is { } oldAway ? score.AwayScore - oldAway : 0;
        var scoringSituation = score.LastScoringPlay ?? InferScoringSituation(homeIncrease, awayIncrease);
        int? scoringTeamId = homeIncrease > 0 && awayIncrease <= 0
            ? game.HomeTeamId
            : awayIncrease > 0 && homeIncrease <= 0
                ? game.AwayTeamId
                : null;

        game.HomeScore = score.HomeScore;
        game.AwayScore = score.AwayScore;
        game.Period = score.Period;
        game.Clock = score.Clock;
        int? resolvedPossessionTeamId = score.PossessionTeamExternalId is { } possessionExternalId
            && teamsByExternalId.TryGetValue(possessionExternalId, out var possessionTeam)
                ? possessionTeam.Id
                : null;
        if (game.Status is GameStatus.InProgress or GameStatus.Halftime)
        {
            if (scoringSituation is not null && scoringTeamId is not null)
            {
                game.PossessionTeamId = scoringTeamId;
                game.DownDistance = scoringSituation;
            }
            else
            {
                if (resolvedPossessionTeamId is not null)
                    game.PossessionTeamId = resolvedPossessionTeamId;
                if (!string.IsNullOrWhiteSpace(score.DownDistance))
                    game.DownDistance = score.DownDistance;
            }
        }
        else
        {
            game.PossessionTeamId = null;
            game.DownDistance = null;
        }
        game.HomeWinProbability = score.HomeWinProbability;
        if (previous != ScoreboardState.Capture(game))
            game.LastUpdatedUtc = _time.GetUtcNow();
    }

    private static string? InferScoringSituation(int homeIncrease, int awayIncrease)
    {
        if (homeIncrease > 0 && awayIncrease > 0) return null;
        var increase = Math.Max(homeIncrease, awayIncrease);
        if (increase == 3) return "Field Goal";
        if (increase >= 6) return "Touchdown";
        return null;
    }

    private void SyncBroadcasts(Game game, IReadOnlyList<string> networks)
    {
        var wanted = networks.ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var stale in game.Broadcasts.Where(b => !wanted.Contains(b.Network)).ToList())
            db.Broadcasts.Remove(stale);

        var have = game.Broadcasts.Select(b => b.Network).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var network in networks.Where(n => !have.Contains(n)))
            game.Broadcasts.Add(new Broadcast { Network = network });
    }

    private async Task<Season> GetOrCreateSeasonAsync(League league, int year, CancellationToken ct)
    {
        var season = await db.Seasons.FirstOrDefaultAsync(s => s.League == league && s.Year == year, ct);
        if (season is not null) return season;

        season = new Season
        {
            League = league,
            Year = year,
            Name = $"{year} {league} Season",
            StartDate = new DateOnly(year, 8, 1),
            EndDate = new DateOnly(year + 1, 2, 15),
        };
        db.Seasons.Add(season);
        await db.SaveChangesAsync(ct);
        return season;
    }

    private async Task<Week> GetOrCreateWeekAsync(Season season, ScheduleFeed feed, CancellationToken ct)
    {
        var kickoffs = feed.Games.Select(g => g.KickoffUtc).DefaultIfEmpty().ToList();
        var startDate = DateOnly.FromDateTime(kickoffs.Min().UtcDateTime);
        var endDate = DateOnly.FromDateTime(kickoffs.Max().UtcDateTime);

        var week = await db.Weeks.FirstOrDefaultAsync(w => w.SeasonId == season.Id && w.Number == feed.Week, ct);
        if (week is not null)
        {
            // Re-imports refresh the displayed date range too -- flex scheduling
            // can shift a week's actual kickoff spread after it was first created.
            week.StartDate = startDate;
            week.EndDate = endDate;
            return week;
        }

        week = new Week
        {
            SeasonId = season.Id,
            Number = feed.Week,
            Label = $"Week {feed.Week}",
            StartDate = startDate,
            EndDate = endDate,
        };
        db.Weeks.Add(week);
        await db.SaveChangesAsync(ct);
        return week;
    }
}
