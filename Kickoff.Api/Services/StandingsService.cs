using Kickoff.Api.Domain;
using Kickoff.Api.Services.Models;
using Microsoft.EntityFrameworkCore;

namespace Kickoff.Api.Services;

/// <summary>Calculates overall team records directly from completed games.</summary>
public class StandingsService(IKickoffContext db, TimeProvider timeProvider)
{
    public async Task<List<TeamRecordDto>> GetRecordsAsync(
        League league,
        int? seasonYear = null,
        CancellationToken ct = default)
    {
        var year = seasonYear ?? ActiveFootballSeasonYear(timeProvider.GetUtcNow());

        var teamIds = await db.Teams
            .Where(team => team.League == league)
            .OrderBy(team => team.DisplayName)
            .Select(team => team.Id)
            .ToListAsync(ct);

        var records = teamIds.ToDictionary(
            teamId => teamId,
            teamId => new MutableRecord(teamId));

        var finals = await db.Games
            .Where(game =>
                game.League == league
                && game.Status == GameStatus.Final
                && game.Week.Season.Year == year
                && game.HomeScore != null
                && game.AwayScore != null)
            .Select(game => new
            {
                game.HomeTeamId,
                game.AwayTeamId,
                HomeScore = game.HomeScore!.Value,
                AwayScore = game.AwayScore!.Value,
            })
            .ToListAsync(ct);

        foreach (var game in finals)
        {
            if (!records.TryGetValue(game.HomeTeamId, out var home)
                || !records.TryGetValue(game.AwayTeamId, out var away))
            {
                continue;
            }

            if (game.HomeScore > game.AwayScore)
            {
                home.Wins++;
                away.Losses++;
            }
            else if (game.HomeScore < game.AwayScore)
            {
                away.Wins++;
                home.Losses++;
            }
            else
            {
                home.Ties++;
                away.Ties++;
            }
        }

        return teamIds
            .Select(teamId => records[teamId].ToDto())
            .ToList();
    }

    private static int ActiveFootballSeasonYear(DateTimeOffset now) =>
        now.Month >= 7 ? now.Year : now.Year - 1;

    private sealed class MutableRecord(int teamId)
    {
        public int Wins { get; set; }
        public int Losses { get; set; }
        public int Ties { get; set; }

        public TeamRecordDto ToDto() => new(teamId, Wins, Losses, Ties);
    }
}
