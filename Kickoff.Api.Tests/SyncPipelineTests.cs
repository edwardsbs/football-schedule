using Kickoff.Api.Domain;
using Kickoff.Api.Integrations.SportsData;
using Kickoff.Api.Integrations.SportsData.Contracts;
using Kickoff.Api.Services.Sync;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

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
            GameStatus.InProgress,
            new ScoreSnapshot(17, 7, 2, "4:11", null, null, null, "Touchdown"))]);

        Assert.Equal(game.HomeTeamId, game.PossessionTeamId);
        Assert.Equal("Touchdown", game.DownDistance);

        await scores.ApplyAsync(League.Nfl, [new GameScoreUpdate(
            game.ExternalId!,
            GameStatus.InProgress,
            new ScoreSnapshot(17, 10, 2, "2:02", null, null, null, "Field Goal"))]);

        Assert.Equal(game.AwayTeamId, game.PossessionTeamId);
        Assert.Equal("Field Goal", game.DownDistance);

        await scores.ApplyAsync(League.Nfl, [new GameScoreUpdate(
            game.ExternalId!,
            GameStatus.Final,
            new ScoreSnapshot(24, 17, 4, "0:00", null, null, null))]);

        Assert.Null(game.PossessionTeamId);
        Assert.Null(game.DownDistance);
    }

    [Fact]
    public async Task Identical_live_polls_do_not_hide_a_frozen_scoreboard()
    {
        using var ctx = TestDb.NewContext();
        var clock = new FakeTimeProvider(T0);
        var (game, home, _) = await SeedStaleGameAsync(ctx, clock.GetUtcNow());
        var scores = new ScoreSyncService(ctx, clock);
        var unchanged = new GameScoreUpdate(
            game.ExternalId!,
            GameStatus.InProgress,
            new ScoreSnapshot(17, 24, 4, "11:40", home.ExternalId, "3rd & 4 at FSU 31", null));

        clock.Advance(TimeSpan.FromMinutes(5));
        await scores.ApplyAsync(League.Ncaa, [unchanged]);

        Assert.Equal(T0, game.LastUpdatedUtc);
    }

    [Fact]
    public async Task Stale_recovery_finalizes_a_game_missing_from_the_rolling_scoreboard()
    {
        using var ctx = TestDb.NewContext();
        var clock = new FakeTimeProvider(T0);
        var (game, _, _) = await SeedStaleGameAsync(ctx, clock.GetUtcNow().AddMinutes(-30));
        var update = new GameScoreUpdate(
            game.ExternalId!,
            GameStatus.Final,
            new ScoreSnapshot(24, 27, null, null, null, null, null));
        var scores = new ScoreSyncService(ctx, clock);
        var recovery = new StaleGameRecoveryService(
            new RecoverySportsDataClient(update),
            scores,
            Options.Create(new SportsDataOptions { StaleGameMinutes = 10 }),
            clock,
            NullLogger<StaleGameRecoveryService>.Instance);

        var result = await recovery.ReconcileAsync(League.Ncaa);

        Assert.Equal(new StaleGameRecoveryResult(1, 1), result);
        Assert.Equal(GameStatus.Final, game.Status);
        Assert.Equal(24, game.HomeScore);
        Assert.Equal(27, game.AwayScore);
        Assert.Null(game.PossessionTeamId);
        Assert.Null(game.DownDistance);
        Assert.Equal(T0, game.LastUpdatedUtc);
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
        Assert.Equal(1, await sync.ApplyAsync(League.Ncaa, [new TeamRanking("first", 4, 7)]));
        Assert.Equal(4, first.CurrentRank);
        Assert.Equal(7, first.PreviousRank);
        Assert.Null(second.CurrentRank);

        Assert.Equal(1, await sync.ApplyAsync(League.Ncaa, [new TeamRanking("second", 7)]));
        Assert.Null(first.CurrentRank);
        Assert.Null(first.PreviousRank);
        Assert.Equal(7, second.CurrentRank);
        Assert.Null(second.PreviousRank);
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

    private static async Task<(Game Game, Team Home, Team Away)> SeedStaleGameAsync(
        KickoffContext ctx,
        DateTimeOffset lastUpdatedUtc)
    {
        var season = new Season
        {
            League = League.Ncaa,
            Year = 2026,
            Name = "2026 NCAA Season",
            StartDate = new DateOnly(2026, 8, 1),
            EndDate = new DateOnly(2027, 2, 15),
        };
        var week = new Week
        {
            Season = season,
            Number = 1,
            Label = "Week 1",
            StartDate = new DateOnly(2026, 9, 1),
            EndDate = new DateOnly(2026, 9, 7),
        };
        var home = new Team
        {
            League = League.Ncaa,
            ExternalId = "52",
            DisplayName = "Florida State Seminoles",
            Abbreviation = "FSU",
        };
        var away = new Team
        {
            League = League.Ncaa,
            ExternalId = "2567",
            DisplayName = "SMU Mustangs",
            Abbreviation = "SMU",
        };
        var game = new Game
        {
            Week = week,
            League = League.Ncaa,
            HomeTeam = home,
            AwayTeam = away,
            ExternalId = "401858212",
            KickoffUtc = T0.AddHours(-8),
            Status = GameStatus.InProgress,
            HomeScore = 17,
            AwayScore = 24,
            Period = 4,
            Clock = "11:40",
            DownDistance = "3rd & 4 at FSU 31",
            LastUpdatedUtc = lastUpdatedUtc,
        };
        ctx.Games.Add(game);
        await ctx.SaveChangesAsync();
        game.PossessionTeamId = home.Id;
        await ctx.SaveChangesAsync();
        return (game, home, away);
    }

    private sealed class RecoverySportsDataClient(GameScoreUpdate update) : ISportsDataClient
    {
        public Task<GameScoreUpdate?> GetGameScoreAsync(
            League league, string gameExternalId, CancellationToken ct = default) =>
            Task.FromResult<GameScoreUpdate?>(
                gameExternalId == update.GameExternalId ? update : null);

        public Task<IReadOnlyList<GameScoreUpdate>> GetLiveScoresAsync(
            League league, CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<GameScoreUpdate>>([]);

        public Task<ScheduleFeed> GetWeekScheduleAsync(
            League league, int seasonYear, int week, CancellationToken ct = default) =>
            Task.FromResult(new ScheduleFeed(league, seasonYear, week, []));

        public Task<IReadOnlyList<FeedTeam>> GetAllTeamsAsync(
            League league, CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<FeedTeam>>([]);

        public Task<IReadOnlyList<TeamRanking>> GetCurrentRankingsAsync(
            League league, CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<TeamRanking>>([]);

        public Task<IReadOnlyList<RankingPoll>> GetCurrentRankingPollsAsync(
            League league, CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<RankingPoll>>([]);

        public Task<RankingPoll?> GetWeeklyRankingsAsync(
            League league,
            int seasonYear,
            int week,
            RankingPollType pollType = RankingPollType.Ap,
            CancellationToken ct = default) =>
            Task.FromResult<RankingPoll?>(null);

        public Task<FeedGameSummary?> GetGameSummaryAsync(
            League league, string gameExternalId, CancellationToken ct = default) =>
            Task.FromResult<FeedGameSummary?>(null);
    }
}
