using Kickoff.Api.Domain;
using Kickoff.Api.Services.Models;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Kickoff.Api.Tests;

/// <summary>
/// Proves the spoiler-safe projection strips result-revealing fields for muted
/// games and only exposes them via the deliberate reveal path. Runs against a
/// real SQLite database so the LINQ actually executes as translated SQL.
/// </summary>
public class SpoilerProtectionTests
{
    private const int UserId = 1;
    private const int OtherUserId = 2;

    [Fact]
    public async Task Unmuted_game_exposes_the_score()
    {
        using var ctx = NewContext();
        var gameId = SeedGame(ctx, GameStatus.Final, homeScore: 27, awayScore: 24);

        var dto = await GetDto(ctx, gameId, UserId);

        Assert.False(dto.IsMuted);
        Assert.NotNull(dto.Score);
        Assert.Equal(27, dto.Score!.HomeScore);
        Assert.Equal(24, dto.Score.AwayScore);
        Assert.Equal(GameSafeStatus.Final, dto.Status);
    }

    [Fact]
    public async Task Muted_game_hides_the_score_entirely()
    {
        using var ctx = NewContext();
        var gameId = SeedGame(ctx, GameStatus.Final, homeScore: 27, awayScore: 24);
        Mute(ctx, gameId, UserId, MuteType.Muted);

        var dto = await GetDto(ctx, gameId, UserId);

        Assert.True(dto.IsMuted);
        Assert.Null(dto.Score);                       // score block is absent, not blanked
        Assert.Equal(GameSafeStatus.Live, dto.Status); // never reveals "Final" while muted
        Assert.Equal(MuteType.Muted, dto.MuteType);
    }

    [Fact]
    public async Task Another_users_mute_does_not_hide_my_score()
    {
        using var ctx = NewContext();
        var gameId = SeedGame(ctx, GameStatus.InProgress, homeScore: 10, awayScore: 7);
        Mute(ctx, gameId, OtherUserId, MuteType.Muted);

        var dto = await GetDto(ctx, gameId, UserId);

        Assert.False(dto.IsMuted);
        Assert.NotNull(dto.Score);
    }

    [Fact]
    public async Task WatchLater_hides_until_marked_watched()
    {
        using var ctx = NewContext();
        var gameId = SeedGame(ctx, GameStatus.Final, homeScore: 31, awayScore: 30);
        Mute(ctx, gameId, UserId, MuteType.WatchLater);

        var hidden = await GetDto(ctx, gameId, UserId);
        Assert.True(hidden.IsMuted);
        Assert.Null(hidden.Score);

        // Mark watched → unlocks.
        var mute = await ctx.GameMutes.FindAsync(UserId, gameId);
        mute!.IsWatched = true;
        await ctx.SaveChangesAsync();

        var unlocked = await GetDto(ctx, gameId, UserId);
        Assert.False(unlocked.IsMuted);
        Assert.NotNull(unlocked.Score);
        Assert.Equal(31, unlocked.Score!.HomeScore);
    }

    [Fact]
    public async Task Reveal_shows_the_score_but_still_reports_muted()
    {
        using var ctx = NewContext();
        var gameId = SeedGame(ctx, GameStatus.Final, homeScore: 20, awayScore: 17);
        Mute(ctx, gameId, UserId, MuteType.Muted);

        var revealed = await ctx.Games
            .Where(g => g.Id == gameId)
            .ToGameDtos(ctx, UserId, revealMuted: true)
            .FirstAsync();

        Assert.True(revealed.IsMuted);        // caller still knows to re-hide afterward
        Assert.NotNull(revealed.Score);       // but the score is shown for the reveal gesture
        Assert.Equal(20, revealed.Score!.HomeScore);
    }

    [Fact]
    public async Task Upcoming_game_has_no_score_block()
    {
        using var ctx = NewContext();
        var gameId = SeedGame(ctx, GameStatus.Scheduled);

        var dto = await GetDto(ctx, gameId, UserId);

        Assert.Null(dto.Score);
        Assert.Equal(GameSafeStatus.Upcoming, dto.Status);
    }

    // --- helpers ---

    private static Task<GameDto> GetDto(KickoffContext ctx, int gameId, int userId) =>
        ctx.Games.Where(g => g.Id == gameId).ToGameDtos(ctx, userId).FirstAsync();

    private static int SeedGame(
        KickoffContext ctx, GameStatus status, int? homeScore = null, int? awayScore = null)
    {
        var season = new Season { League = League.Nfl, Year = 2026, Name = "2026" };
        var week = new Week { Season = season, Number = 1, Label = "Week 1" };
        var home = new Team { League = League.Nfl, DisplayName = "Home", Abbreviation = "HOM" };
        var away = new Team { League = League.Nfl, DisplayName = "Away", Abbreviation = "AWY" };
        var game = new Game
        {
            Week = week,
            League = League.Nfl,
            HomeTeam = home,
            AwayTeam = away,
            KickoffUtc = new DateTimeOffset(2026, 9, 13, 17, 0, 0, TimeSpan.Zero),
            Status = status,
            HomeScore = homeScore,
            AwayScore = awayScore,
            Period = status == GameStatus.Final ? 4 : null,
        };
        ctx.Add(game);
        ctx.SaveChanges();
        return game.Id;
    }

    private static void Mute(KickoffContext ctx, int gameId, int userId, MuteType type)
    {
        ctx.GameMutes.Add(new GameMute
        {
            UserId = userId,
            GameId = gameId,
            MuteType = type,
            CreatedUtc = DateTimeOffset.UtcNow,
        });
        ctx.SaveChanges();
    }

    private static KickoffContext NewContext()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();
        var options = new DbContextOptionsBuilder<KickoffContext>()
            .UseSqlite(connection)
            .Options;
        var ctx = new KickoffContext(options);
        ctx.Database.EnsureCreated();

        // Users must exist before mutes can reference them (FK). Ids 1 and 2.
        ctx.Users.Add(new User { Name = "Dev" });
        ctx.Users.Add(new User { Name = "Other" });
        ctx.SaveChanges();

        return ctx;
    }
}
