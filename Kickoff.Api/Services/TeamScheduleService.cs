using Kickoff.Api.Domain;
using Kickoff.Api.Services.Models;
using Microsoft.EntityFrameworkCore;

namespace Kickoff.Api.Services;

/// <summary>Reads one team's spoiler-safe schedule for a football season.</summary>
public class TeamScheduleService(IKickoffContext db)
{
    public async Task<TeamScheduleDto?> GetAsync(
        int teamId,
        int userId,
        int? seasonYear = null,
        CancellationToken ct = default)
    {
        var team = await db.Teams
            .Where(t => t.Id == teamId)
            .Select(t => new
            {
                Summary = new TeamSummaryDto(
                    t.Id, t.DisplayName, t.Abbreviation, t.LogoUrl, t.PrimaryColor,
                    t.CurrentRank, t.PreviousRank, t.IsFcs),
                t.League,
            })
            .FirstOrDefaultAsync(ct);
        if (team is null) return null;

        var teamGames = db.Games.Where(g => g.HomeTeamId == teamId || g.AwayTeamId == teamId);
        var resolvedSeasonYear = seasonYear ?? await teamGames
            .Select(g => (int?)g.Week.Season.Year)
            .MaxAsync(ct)
            ?? DateTimeOffset.UtcNow.Year;

        var games = await teamGames
            .Where(g => g.Week.Season.Year == resolvedSeasonYear)
            .OrderBy(g => g.KickoffUtc)
            .ToGameDtos(db, userId)
            .ToListAsync(ct);

        return new TeamScheduleDto(team.Summary, team.League, resolvedSeasonYear, games);
    }
}
