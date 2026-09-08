using Kickoff.Api.Domain;
using Kickoff.Api.Integrations.SportsData;
using Kickoff.Api.Integrations.SportsData.Contracts;
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
    public async Task<ActionResult<NcaaRankingsDto>> NcaaWeekly(
        [FromQuery] int seasonYear,
        [FromQuery] int week,
        CancellationToken ct)
    {
        if (seasonYear is < 2000 or > 2100 || week is < 0 or > 25)
            return BadRequest("Invalid NCAA season year or week.");

        var apTask = GetWeeklyPollAsync(seasonYear, week, RankingPollType.Ap, ct);
        var cfpTask = week >= 9
            ? GetWeeklyPollAsync(seasonYear, week, RankingPollType.Cfp, ct)
            : Task.FromResult<RankingPoll?>(null);
        await Task.WhenAll(apTask, cfpTask);

        var polls = new[] { await apTask, await cfpTask }
            .OfType<RankingPoll>()
            .ToList();

        return await MapPollsAsync(polls, seasonYear, week, ct);
    }

    [HttpGet("ncaa/current")]
    public async Task<ActionResult<NcaaRankingsDto>> NcaaCurrent(CancellationToken ct)
    {
        var polls = await cache.GetOrCreateAsync("rankings:ncaa:current", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30);
            return await sportsData.GetCurrentRankingPollsAsync(League.Ncaa, ct);
        }) ?? [];

        if (polls.Count == 0) return NotFound();
        return await MapPollsAsync(polls, polls.Max(poll => poll.SeasonYear), null, ct);
    }

    private async Task<RankingPoll?> GetWeeklyPollAsync(
        int seasonYear,
        int week,
        RankingPollType pollType,
        CancellationToken ct)
    {
        var cacheKey = $"rankings:ncaa:{seasonYear}:{week}:{pollType}";
        return await cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(6);
            return await sportsData.GetWeeklyRankingsAsync(
                League.Ncaa, seasonYear, week, pollType, ct);
        });
    }

    private async Task<ActionResult<NcaaRankingsDto>> MapPollsAsync(
        IReadOnlyList<RankingPoll> polls,
        int seasonYear,
        int? requestedWeek,
        CancellationToken ct)
    {
        if (polls.Count == 0) return NotFound();

        var externalIds = polls
            .SelectMany(poll => poll.Rankings)
            .Select(ranking => ranking.TeamExternalId)
            .Distinct()
            .ToList();
        var teams = await db.Teams
            .Where(team => team.League == League.Ncaa
                && team.ExternalId != null
                && externalIds.Contains(team.ExternalId))
            .ToDictionaryAsync(team => team.ExternalId!, ct);

        var mappedPolls = polls.Select(poll =>
        {
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

            var selectedWeek = requestedWeek ?? poll.WeekNumber;
            var isExactWeek = requestedWeek is null
                || (poll.Type == RankingPollType.Ap && poll.IsPreseason
                    ? selectedWeek <= 1
                    : poll.WeekNumber == selectedWeek);
            return new RankingPollDto(
                poll.Type == RankingPollType.Cfp ? "cfp" : "ap",
                poll.Type == RankingPollType.Cfp
                    ? "College Football Playoff"
                    : "Associated Press",
                poll.Name,
                poll.Label,
                poll.SeasonYear,
                selectedWeek,
                poll.WeekNumber,
                isExactWeek,
                poll.PublishedAt,
                rankings);
        }).ToList();

        return Ok(new NcaaRankingsDto(seasonYear, requestedWeek, mappedPolls));
    }
}
