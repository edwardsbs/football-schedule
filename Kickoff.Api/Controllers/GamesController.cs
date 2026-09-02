using Kickoff.Api.Domain;
using Kickoff.Api.Services;
using Kickoff.Api.Services.Models;
using Microsoft.AspNetCore.Mvc;

namespace Kickoff.Api.Controllers;

public record MuteRequest(MuteType Type);
public record CircleRequest(string? Note);

[ApiController]
[Route("api/games")]
public class GamesController(
    GameQueryService queries,
    MuteService mutes,
    CircledService circled,
    ICurrentUser user) : ControllerBase
{
    /// <summary>Live dashboard tiles (spoiler-safe).</summary>
    [HttpGet("live")]
    public Task<List<GameDto>> Live(CancellationToken ct) =>
        queries.GetLiveAsync(user.Id, ct);

    /// <summary>Merged timeline between two instants (day/week views).</summary>
    [HttpGet]
    public Task<List<GameDto>> Range(
        [FromQuery] DateTimeOffset from, [FromQuery] DateTimeOffset to, CancellationToken ct) =>
        queries.GetByKickoffRangeAsync(user.Id, from, to, ct);

    /// <summary>Circled games ("Upcoming"), soonest first.</summary>
    [HttpGet("circled")]
    public Task<List<GameDto>> Circled(CancellationToken ct) =>
        circled.ListAsync(user.Id, ct);

    [HttpGet("{id:int}")]
    public async Task<ActionResult<GameDto>> Get(int id, CancellationToken ct) =>
        await queries.GetByIdAsync(id, user.Id, ct) is { } dto ? dto : NotFound();

    /// <summary>Deliberate reveal gesture: returns the score even while muted.</summary>
    [HttpGet("{id:int}/reveal")]
    public async Task<ActionResult<GameDto>> Reveal(int id, CancellationToken ct) =>
        await queries.RevealAsync(id, user.Id, ct) is { } dto ? dto : NotFound();

    [HttpPut("{id:int}/mute")]
    public async Task<IActionResult> Mute(int id, [FromBody] MuteRequest body, CancellationToken ct)
    {
        await mutes.MuteAsync(id, user.Id, body.Type, ct);
        return NoContent();
    }

    [HttpDelete("{id:int}/mute")]
    public async Task<IActionResult> Unmute(int id, CancellationToken ct)
    {
        await mutes.UnmuteAsync(id, user.Id, ct);
        return NoContent();
    }

    [HttpPost("{id:int}/watched")]
    public async Task<IActionResult> Watched(int id, CancellationToken ct)
    {
        await mutes.MarkWatchedAsync(id, user.Id, ct);
        return NoContent();
    }

    [HttpPut("{id:int}/circle")]
    public async Task<IActionResult> Circle(int id, [FromBody] CircleRequest? body, CancellationToken ct) =>
        await circled.CircleAsync(user.Id, id, body?.Note, ct) ? NoContent() : NotFound();

    [HttpDelete("{id:int}/circle")]
    public async Task<IActionResult> Uncircle(int id, CancellationToken ct)
    {
        await circled.UncircleAsync(user.Id, id, ct);
        return NoContent();
    }
}
