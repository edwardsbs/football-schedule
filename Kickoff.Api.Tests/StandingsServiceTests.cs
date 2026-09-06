using Kickoff.Api.Domain;
using Kickoff.Api.Services;

namespace Kickoff.Api.Tests;

public class StandingsServiceTests
{
    [Fact]
    public async Task Records_count_only_final_games_in_requested_season_and_league()
    {
        await using var db = TestDb.NewContext();
        var home = Team(League.Nfl, "Home");
        var away = Team(League.Nfl, "Away");
        var idle = Team(League.Nfl, "Idle");
        var ncaa = Team(League.Ncaa, "College");
        db.Teams.AddRange(home, away, idle, ncaa);

        var currentWeek = Week(League.Nfl, 2026);
        var previousWeek = Week(League.Nfl, 2025);
        var ncaaWeek = Week(League.Ncaa, 2026);
        db.Weeks.AddRange(currentWeek, previousWeek, ncaaWeek);
        await db.SaveChangesAsync();

        db.Games.AddRange(
            Game(currentWeek, home, away, GameStatus.Final, 24, 17),
            Game(currentWeek, away, home, GameStatus.Final, 10, 10),
            Game(currentWeek, home, away, GameStatus.InProgress, 3, 14),
            Game(previousWeek, away, home, GameStatus.Final, 30, 7),
            Game(ncaaWeek, ncaa, ncaa, GameStatus.Final, 7, 3));
        await db.SaveChangesAsync();

        var service = new StandingsService(db, new FakeTimeProvider(new DateTimeOffset(2026, 9, 6, 12, 0, 0, TimeSpan.Zero)));
        var records = await service.GetRecordsAsync(League.Nfl);

        Assert.Equal(3, records.Count);
        AssertRecord(records, home.Id, wins: 1, losses: 0, ties: 1);
        AssertRecord(records, away.Id, wins: 0, losses: 1, ties: 1);
        AssertRecord(records, idle.Id, wins: 0, losses: 0, ties: 0);
    }

    private static Team Team(League league, string name) => new()
    {
        League = league,
        Location = name,
        Name = name,
        DisplayName = name,
        Abbreviation = name[..Math.Min(3, name.Length)].ToUpperInvariant(),
    };

    private static Week Week(League league, int year) => new()
    {
        Season = new Season
        {
            League = league,
            Year = year,
            Name = $"{year} {league}",
            StartDate = new DateOnly(year, 8, 1),
            EndDate = new DateOnly(year + 1, 2, 15),
        },
        Number = 1,
        Label = "Week 1",
        StartDate = new DateOnly(year, 9, 1),
        EndDate = new DateOnly(year, 9, 7),
    };

    private static Game Game(
        Week week,
        Team home,
        Team away,
        GameStatus status,
        int homeScore,
        int awayScore) => new()
    {
        Week = week,
        League = week.Season.League,
        HomeTeam = home,
        AwayTeam = away,
        KickoffUtc = new DateTimeOffset(week.Season.Year, 9, 6, 12, 0, 0, TimeSpan.Zero),
        Status = status,
        HomeScore = homeScore,
        AwayScore = awayScore,
    };

    private static void AssertRecord(
        IEnumerable<Kickoff.Api.Services.Models.TeamRecordDto> records,
        int teamId,
        int wins,
        int losses,
        int ties)
    {
        var record = Assert.Single(records, record => record.TeamId == teamId);
        Assert.Equal(wins, record.Wins);
        Assert.Equal(losses, record.Losses);
        Assert.Equal(ties, record.Ties);
    }
}
