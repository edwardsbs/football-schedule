using Kickoff.Api.Services;
using Kickoff.Api.Services.Models;
using Microsoft.AspNetCore.Mvc;

namespace Kickoff.Api.Controllers;

[ApiController]
[Route("api/favorites/teams")]
public class FavoritesController(FavoritesService favorites, ICurrentUser user) : ControllerBase
{
    [HttpGet]
    public Task<List<FavoriteTeamDto>> List(CancellationToken ct) =>
        favorites.ListAsync(user.Id, ct);

    [HttpPut("{teamId:int}")]
    public async Task<IActionResult> Add(int teamId, CancellationToken ct) =>
        await favorites.AddAsync(user.Id, teamId, ct) ? NoContent() : NotFound();

    [HttpDelete("{teamId:int}")]
    public async Task<IActionResult> Remove(int teamId, CancellationToken ct)
    {
        await favorites.RemoveAsync(user.Id, teamId, ct);
        return NoContent();
    }
}
