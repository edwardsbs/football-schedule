using Kickoff.Api.Domain;
using Kickoff.Api.Integrations.SportsData;
using Kickoff.Api.Integrations.SportsData.Contracts;
using Kickoff.Api.Services.Sync;
using Microsoft.EntityFrameworkCore;

namespace Kickoff.Api.Tests;

/// <summary>
/// Exercises the full sync pipeline with the simulator and a fake clock:
/// import a week's schedule, then advance time and apply live scores.
/// </summary>
public class SyncPipelineTests
{
    private static readonly DateTimeOffset T0 = new(2026, 9, 13, 17, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Importing_a_week_creates_teams_and_games_with_some_already_live()
    {
        using var ctx = TestDb.NewContext();
        var clock = new FakeTimeProvider(T0);
        var client = new SimulatedSportsDataClient(clock);
        var import = new ScheduleImportService(ctx);

        var feed = await client.GetWeekScheduleAsync(League.Nfl, 2026, 1);
        var result = await import.ImportAsync(feed);

        Assert.Equal(4, await ctx.Games.CountAsync());     // 8 roster teams → 4 games
        Assert.Equal(8, await ctx.Teams.CountAsync());
        Assert.Equal(4, result.GamesAdded);
        Assert.True(await ctx.Games.AnyAsync(g => g.Status == GameStatus.InProgress),
            "games kicked off before T0 should already be live");
    }

    [Fact]
    public async Task Reimport_is_idempotent()
    {
        using var ctx = TestDb.NewContext();
        var client = new SimulatedSportsDataClient(new FakeTimeProvider(T0));
        var import = new ScheduleImportService(ctx);

        await import.ImportAsync(await client.GetWeekScheduleAsync(League.Nfl, 2026, 1));
        var second = await import.ImportAsync(await client.GetWeekScheduleAsync(League.Nfl, 2026, 1));

        Assert.Equal(4, await ctx.Games.CountAsync());     // no duplicates
        Assert.Equal(0, second.GamesAdded);
        Assert.Equal(4, second.GamesUpdated);
    }

    [Fact]
    public async Task Live_score_sync_advances_games_to_final()
    {
        using var ctx = TestDb.NewContext();
        var clock = new FakeTimeProvider(T0);
        var client = new SimulatedSportsDataClient(clock);
        var import = new ScheduleImportService(ctx);
        var scores = new ScoreSyncService(ctx);

        await import.ImportAsync(await client.GetWeekScheduleAsync(League.Nfl, 2026, 1));

        // Jump well past the end of every game, then poll+apply.
        clock.Advance(TimeSpan.FromMinutes(200));
        var updates = await client.GetLiveScoresAsync(League.Nfl);
        var applied = await scores.ApplyAsync(League.Nfl, updates);

        Assert.True(applied > 0);
        var games = await ctx.Games.ToListAsync();
        Assert.All(games, g => Assert.Equal(GameStatus.Final, g.Status));
        Assert.All(games, g => Assert.NotNull(g.LastUpdatedUtc));
    }

    [Fact]
    public async Task Live_score_sync_maps_provider_possession_to_the_local_team()
    {
        using var ctx = TestDb.NewContext();
        var client = new SimulatedSportsDataClient(new FakeTimeProvider(T0));
        var import = new ScheduleImportService(ctx);
        var scores = new ScoreSyncService(ctx);

        await import.ImportAsync(await client.GetWeekScheduleAsync(League.Nfl, 2026, 1));
        var game = await ctx.Games
            .Include(g => g.AwayTeam)
            .FirstAsync();
        var update = new GameScoreUpdate(
            game.ExternalId!,
            GameStatus.InProgress,
            new ScoreSnapshot(7, 3, 2, "8:42", game.AwayTeam.ExternalId, "2nd & 6", null));

        await scores.ApplyAsync(League.Nfl, [update]);

        Assert.Equal(game.AwayTeamId, game.PossessionTeamId);
        Assert.Equal("2nd & 6", game.DownDistance);
    }

    [Fact]
    public async Task Live_score_sync_retains_situation_during_a_transient_feed_gap_and_clears_it_at_final()
    {
        using var ctx = TestDb.NewContext();
        var client = new SimulatedSportsDataClient(new FakeTimeProvider(T0));
        var import = new ScheduleImportService(ctx);
        var scores = new ScoreSyncService(ctx);

        await import.ImportAsync(await client.GetWeekScheduleAsync(League.Nfl, 2026, 1));
        var game = await ctx.Games.Include(g => g.HomeTeam).FirstAsync();

        await scores.ApplyAsync(League.Nfl, [new GameScoreUpdate(
            game.ExternalId!,
            GameStatus.InProgress,
            new ScoreSnapshot(10, 7, 2, "4:31", game.HomeTeam.ExternalId, "2nd & 6 at HOM 44", null))]);

        await scores.ApplyAsync(League.Nfl, [new GameScoreUpdate(
            game.ExternalId!,
            GameStatus.InProgress,
            new ScoreSnapshot(10, 7, 2, "4:18", null, null, null))]);

        Assert.Equal(game.HomeTeamId, game.PossessionTeamId);
        Assert.Equal("2nd & 6 at HOM 44", game.DownDistance);
        Assert.Equal("4:18", game.Clock);

        await scores.ApplyAsync(League.Nfl, [new GameScoreUpdate(
            game.ExternalId!,
            GameStatus.Final,
            new ScoreSnapshot(24, 17, 4, "0:00", null, null, null))]);

        Assert.Null(game.PossessionTeamId);
        Assert.Null(game.DownDistance);
    }

    [Fact]
    public async Task Rankings_sync_replaces_the_previous_current_poll()
    {
        using var ctx = TestDb.NewContext();
        var first = new Team { League = League.Ncaa, ExternalId = "first", DisplayName = "First" };
        var second = new Team { League = League.Ncaa, ExternalId = "second", DisplayName = "Second" };
        ctx.Teams.AddRange(first, second);
        await ctx.SaveChangesAsync();

        var sync = new RankingsSyncService(ctx);
        Assert.Equal(1, await sync.ApplyAsync(League.Ncaa, [new TeamRanking("first", 4)]));
        Assert.Equal(4, first.CurrentRank);
        Assert.Null(second.CurrentRank);

        Assert.Equal(1, await sync.ApplyAsync(League.Ncaa, [new TeamRanking("second", 7)]));
        Assert.Null(first.CurrentRank);
        Assert.Equal(7, second.CurrentRank);
    }

    [Fact]
    public async Task Schedule_import_persists_an_fcs_team_classification()
    {
        using var ctx = TestDb.NewContext();
        var import = new ScheduleImportService(ctx);
        var fbs = new FeedTeam("fbs", "State", "Bears", "State Bears", "ST", IsFcs: false);
        var fcs = new FeedTeam("fcs", "Valley", "Eagles", "Valley Eagles", "VAL", IsFcs: true);
        var feed = new ScheduleFeed(
            League.Ncaa,
            2026,
            1,
            [new FeedGame("fcs-game", T0, fbs, fcs, GameStatus.Scheduled, null, [], null)]);

        await import.ImportAsync(feed);

        Assert.True((await ctx.Teams.SingleAsync(team => team.ExternalId == "fcs")).IsFcs);
        Assert.False((await ctx.Teams.SingleAsync(team => team.ExternalId == "fbs")).IsFcs);
    }
}
