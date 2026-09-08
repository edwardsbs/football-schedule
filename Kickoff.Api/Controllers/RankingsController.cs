using Kickoff.Api.Domain;
using Kickoff.Api.Integrations.SportsData;
using Kickoff.Api.Services.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Kickoff.Api.Controllers;

[ApiController]
[Route("api/rankings")]
public class RankingsController(
    ISportsDataClient sportsData,
    IKickoffContext db,
    IMemoryCache cache) : ControllerBase
{
    [HttpGet("ncaa")]
    public async Task<ActionResult<RankingPollDto>> NcaaWeekly(
        [FromQuery] int seasonYear,
        [FromQuery] int week,
        CancellationToken ct)
    {
        if (seasonYear is < 2000 or > 2100 || week is < 0 or > 25)
            return BadRequest("Invalid NCAA season year or week.");

        var cacheKey = $"rankings:ncaa:{seasonYear}:{week}";
        var poll = await cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(6);
            return await sportsData.GetWeeklyRankingsAsync(League.Ncaa, seasonYear, week, ct);
        });

        if (poll is null) return NotFound();

        var externalIds = poll.Rankings.Select(ranking => ranking.TeamExternalId).ToList();
        var teams = await db.Teams
            .Where(team => team.League == League.Ncaa
                && team.ExternalId != null
                && externalIds.Contains(team.ExternalId))
            .ToDictionaryAsync(team => team.ExternalId!, ct);

        var rankings = poll.Rankings
            .Where(ranking => teams.ContainsKey(ranking.TeamExternalId))
            .Select(ranking =>
            {
                var team = teams[ranking.TeamExternalId];
                return new RankedTeamDto(
                    team.Id,
                    team.DisplayName,
                    team.Abbreviation,
                    team.LogoUrl,
                    ranking.Rank,
                    ranking.PreviousRank);
            })
            .OrderBy(ranking => ranking.Rank)
            .ToList();

        var isExactWeek = poll.IsPreseason ? week <= 1 : poll.WeekNumber == week;
        return Ok(new RankingPollDto(
            "Associated Press",
            poll.Name,
            poll.Label,
            poll.SeasonYear,
            week,
            poll.WeekNumber,
            isExactWeek,
            poll.PublishedAt,
            rankings));
    }
}
