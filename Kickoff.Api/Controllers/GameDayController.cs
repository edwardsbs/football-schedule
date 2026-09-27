using Kickoff.Api.Services;
using Kickoff.Api.Services.Models;
using Microsoft.AspNetCore.Mvc;

namespace Kickoff.Api.Controllers;

public record GameDayPreferenceRequest(bool Watching, bool SuppressAutomatic = false);
public record GameDayImportRequest(
    IReadOnlyList<int>? WatchedGameIds,
    IReadOnlyList<int>? AutoExcludedGameIds);

[ApiController]
[Route("api/game-day")]
public class GameDayController(GameDayService gameDay, ICurrentUser user) : ControllerBase
{
    [HttpGet]
    public Task<GameDayBoardDto> Get(CancellationToken ct) =>
        gameDay.GetAsync(user.Id, ct);

    [HttpPut("games/{gameId:int}")]
    public async Task<ActionResult<GameDayBoardDto>> Set(
        int gameId,
        [FromBody] GameDayPreferenceRequest body,
        CancellationToken ct) =>
        await gameDay.SetAsync(user.Id, gameId, body.Watching, body.SuppressAutomatic, ct) is { } board
            ? board
            : NotFound();

    [HttpPost("import")]
    public Task<GameDayBoardDto> Import([FromBody] GameDayImportRequest body, CancellationToken ct) =>
        gameDay.ImportAsync(
            user.Id,
            body.WatchedGameIds ?? [],
            body.AutoExcludedGameIds ?? [],
            ct);
}
