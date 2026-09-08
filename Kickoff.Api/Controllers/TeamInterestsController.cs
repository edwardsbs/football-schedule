using Kickoff.Api.Services;
using Kickoff.Api.Services.Models;
using Microsoft.AspNetCore.Mvc;

namespace Kickoff.Api.Controllers;

[ApiController]
[Route("api/team-interests")]
public class TeamInterestsController(TeamInterestsService interests, ICurrentUser user) : ControllerBase
{
    [HttpGet]
    public Task<List<TeamInterestDto>> List(CancellationToken ct) =>
        interests.ListAsync(user.Id, ct);

    [HttpPut("{teamId:int}")]
    public async Task<IActionResult> Add(int teamId, CancellationToken ct) =>
        await interests.AddAsync(user.Id, teamId, ct) ? NoContent() : NotFound();

    [HttpDelete("{teamId:int}")]
    public async Task<IActionResult> Remove(int teamId, CancellationToken ct)
    {
        await interests.RemoveAsync(user.Id, teamId, ct);
        return NoContent();
    }
}
