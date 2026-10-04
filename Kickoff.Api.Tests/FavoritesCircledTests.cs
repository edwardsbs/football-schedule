using Kickoff.Api.Domain;
using Kickoff.Api.Services;
using Kickoff.Api.Services.Models;
using Microsoft.EntityFrameworkCore;

namespace Kickoff.Api.Tests;

public class FavoritesCircledTests
{
    private const int UserId = 1;

    [Fact]
    public async Task Favoriting_a_team_flags_its_games_and_lists_it()
    {
        using var ctx = TestDb.NewContext();
        var (gameId, homeTeamId, _) = Seed(ctx);
        var favorites = new FavoritesService(ctx);

        Assert.False((await Dto(ctx, gameId)).HasFavorite);

        Assert.True(await favorites.AddAsync(UserId, homeTeamId));

        Assert.True((await Dto(ctx, gameId)).HasFavorite);
        var list = await favorites.ListAsync(UserId);
        Assert.Single(list);
        Assert.Equal(homeTeamId, list[0].TeamId);

        await favorites.RemoveAsync(UserId, homeTeamId);
        Assert.False((await Dto(ctx, gameId)).HasFavorite);
        Assert.Empty(await favorites.ListAsync(UserId));
    }

    [Fact]
    public async Task Favoriting_a_missing_team_returns_false()
    {
        using var ctx = TestDb.NewContext();
        Seed(ctx);
        var favorites = new FavoritesService(ctx);

        Assert.False(await favorites.AddAsync(UserId, 9999));
    }

    [Fact]
    public async Task Team_of_interest_is_persistent_and_independent_of_favorites()
    {
        using var ctx = TestDb.NewContext();
        var (gameId, homeTeamId, _) = Seed(ctx);
        var interests = new TeamInterestsService(ctx);

        Assert.True(await interests.AddAsync(UserId, homeTeamId));
        var game = await Dto(ctx, gameId);
        Assert.True(game.HasInterest);
        Assert.False(game.HasFavorite);

        var list = await interests.ListAsync(UserId);
        Assert.Single(list);
        Assert.Equal(homeTeamId, list[0].TeamId);

        await interests.RemoveAsync(UserId, homeTeamId);
        Assert.False((await Dto(ctx, gameId)).HasInterest);
        Assert.Empty(await interests.ListAsync(UserId));
    }

    [Fact]
    public async Task Circling_a_game_flags_it_and_lists_it()
    {
        using var ctx = TestDb.NewContext();
        var (gameId, _, _) = Seed(ctx);
        var circled = new CircledService(ctx);

        Assert.False((await Dto(ctx, gameId)).IsCircled);

        Assert.True(await circled.CircleAsync(UserId, gameId, "rivalry"));

        Assert.True((await Dto(ctx, gameId)).IsCircled);
        var list = await circled.ListAsync(UserId);
        Assert.Single(list);
        Assert.Equal(gameId, list[0].Id);

        await circled.UncircleAsync(UserId, gameId);
        Assert.False((await Dto(ctx, gameId)).IsCircled);
        Assert.Empty(await circled.ListAsync(UserId));
    }

    [Fact]
    public async Task Game_day_choices_are_persistent_and_user_scoped()
    {
        using var ctx = TestDb.NewContext();
        var (gameId, _, _) = Seed(ctx);
        var gameDay = new GameDayService(ctx);

        var selected = await gameDay.SetAsync(UserId, gameId, watching: true, suppressAutomatic: false);
        Assert.NotNull(selected);
        Assert.Equal([gameId], selected.WatchedGameIds);
        Assert.Empty(selected.AutoExcludedGameIds);

        var otherUser = new User { Name = "Other" };
        ctx.Users.Add(otherUser);
        await ctx.SaveChangesAsync();
        Assert.Empty((await gameDay.GetAsync(otherUser.Id)).WatchedGameIds);

        var excluded = await gameDay.SetAsync(UserId, gameId, watching: false, suppressAutomatic: true);
        Assert.NotNull(excluded);
        Assert.Empty(excluded.WatchedGameIds);
        Assert.Equal([gameId], excluded.AutoExcludedGameIds);

        var removed = await gameDay.SetAsync(UserId, gameId, watching: false, suppressAutomatic: false);
        Assert.NotNull(removed);
        Assert.Empty(removed.WatchedGameIds);
        Assert.Empty(removed.AutoExcludedGameIds);
    }

    [Fact]
    public async Task Game_day_import_combines_local_choices_without_overwriting_server_choices()
    {
        using var ctx = TestDb.NewContext();
        var (firstGameId, homeTeamId, awayTeamId) = Seed(ctx);
        var week = await ctx.Weeks.SingleAsync();
        var second = new Game
        {
            Week = week,
            League = League.Nfl,
            HomeTeamId = homeTeamId,
            AwayTeamId = awayTeamId,
            KickoffUtc = new DateTimeOffset(2026, 9, 20, 17, 0, 0, TimeSpan.Zero),
            Status = GameStatus.Scheduled,
        };
        ctx.Games.Add(second);
        await ctx.SaveChangesAsync();
        var gameDay = new GameDayService(ctx);
        await gameDay.SetAsync(UserId, firstGameId, watching: false, suppressAutomatic: true);

        var imported = await gameDay.ImportAsync(
            UserId,
            [firstGameId, second.Id, 9999],
            []);

        Assert.Equal([second.Id], imported.WatchedGameIds);
        Assert.Equal([firstGameId], imported.AutoExcludedGameIds);
    }

    [Fact]
    public async Task Team_schedule_returns_the_latest_season_with_spoiler_protection()
    {
        using var ctx = TestDb.NewContext();
        var (gameId, homeTeamId, _) = Seed(ctx);
        var game = await ctx.Games.FindAsync(gameId);
        Assert.NotNull(game);
        game.Status = GameStatus.Final;
        game.HomeScore = 24;
        game.AwayScore = 17;
        await ctx.SaveChangesAsync();
        await new MuteService(ctx).MuteAsync(gameId, UserId, MuteType.Muted);

        var schedule = await new TeamScheduleService(ctx).GetAsync(homeTeamId, UserId);

        Assert.NotNull(schedule);
        Assert.Equal(homeTeamId, schedule.Team.Id);
        Assert.Equal(League.Nfl, schedule.League);
        Assert.Equal(2026, schedule.SeasonYear);
        var scheduledGame = Assert.Single(schedule.Games);
        Assert.True(scheduledGame.IsMuted);
        Assert.Null(scheduledGame.Score);
        Assert.Equal(GameSafeStatus.Live, scheduledGame.Status);
    }

    private static Task<GameDto> Dto(KickoffContext ctx, int gameId) =>
        ctx.Games.Where(g => g.Id == gameId).ToGameDtos(ctx, UserId).FirstAsync();

    private static (int gameId, int homeTeamId, int awayTeamId) Seed(KickoffContext ctx)
    {
        ctx.Users.Add(new User { Name = "Dev" });
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
            Status = GameStatus.Scheduled,
        };
        ctx.Add(game);
        ctx.SaveChanges();
        return (game.Id, home.Id, away.Id);
    }
}
