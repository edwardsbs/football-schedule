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
