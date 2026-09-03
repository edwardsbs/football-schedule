using Kickoff.Api.Domain;
using Kickoff.Api.Integrations.SportsData;
using Kickoff.Api.Services;
using Kickoff.Api.Services.Sync;
using Microsoft.AspNetCore.Mvc;

namespace Kickoff.Api.Controllers;

/// <summary>
/// Manual sync triggers. Gated by <see cref="AdminApiKeyFilter"/> — requires an
/// X-Admin-Key header matching Admin:SyncApiKey wherever that's configured (unset
/// locally, set via env var in prod).
/// </summary>
[ApiController]
[Route("api/admin/sync")]
[TypeFilter(typeof(AdminApiKeyFilter))]
public class AdminSyncController(
    ISportsDataClient client,
    ScheduleImportService import) : ControllerBase
{
    /// <summary>Pull one league/week schedule from the provider and upsert it.</summary>
    [HttpPost("schedule")]
    public async Task<ActionResult<ScheduleImportResult>> ImportSchedule(
        [FromQuery] League league,
        [FromQuery] int year,
        [FromQuery] int week,
        CancellationToken ct)
    {
        if (year < 2000 || week is < 1 or > 25) return BadRequest("Invalid year or week.");

        var feed = await client.GetWeekScheduleAsync(league, year, week, ct);
        var result = await import.ImportAsync(feed, ct);
        return Ok(result);
    }
}
