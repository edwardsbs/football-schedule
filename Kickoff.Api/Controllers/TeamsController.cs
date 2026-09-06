using Kickoff.Api.Domain;
using Kickoff.Api.Services;
using Kickoff.Api.Services.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kickoff.Api.Controllers;

[ApiController]
[Route("api/teams")]
public class TeamsController(IKickoffContext db, StandingsService standings) : ControllerBase
{
    /// <summary>Every known team for a league, real ids included -- lets the
    /// client resolve a favorite-able team id for any team it already knows
    /// about client-side (e.g. the conference alignment pages).</summary>
    [HttpGet]
    public async Task<List<TeamSummaryDto>> ByLeague([FromQuery] League league, CancellationToken ct) =>
        await db.Teams
            .Where(t => t.League == league)
            .OrderBy(t => t.DisplayName)
            .Select(t => new TeamSummaryDto(
                t.Id, t.DisplayName, t.Abbreviation, t.LogoUrl, t.PrimaryColor, t.CurrentRank))
            .ToListAsync(ct);

    /// <summary>Overall W/L/T records calculated from final games in a season.</summary>
    [HttpGet("records")]
    public Task<List<TeamRecordDto>> Records(
        [FromQuery] League league,
        [FromQuery] int? seasonYear,
        CancellationToken ct) =>
        standings.GetRecordsAsync(league, seasonYear, ct);
}
