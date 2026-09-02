using Kickoff.Api.Domain;
using Kickoff.Api.Integrations.SportsRadar;
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
        var client = new SimulatedSportsRadarClient(clock);
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
        var client = new SimulatedSportsRadarClient(new FakeTimeProvider(T0));
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
        var client = new SimulatedSportsRadarClient(clock);
        var import = new ScheduleImportService(ctx);
        var scores = new ScoreSyncService(ctx);

        await import.ImportAsync(await client.GetWeekScheduleAsync(League.Nfl, 2026, 1));

        // Jump well past the end of every game, then poll+apply.
        clock.Advance(TimeSpan.FromMinutes(200));
        var updates = await client.GetLiveScoresAsync(League.Nfl);
        var applied = await scores.ApplyAsync(updates);

        Assert.True(applied > 0);
        var games = await ctx.Games.ToListAsync();
        Assert.All(games, g => Assert.Equal(GameStatus.Final, g.Status));
        Assert.All(games, g => Assert.NotNull(g.LastUpdatedUtc));
    }
}
