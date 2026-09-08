using Kickoff.Api.Domain;
using Kickoff.Api.Services.Models;
using Microsoft.EntityFrameworkCore;

namespace Kickoff.Api.Services;

/// <summary>Persistent teams to monitor without changing the user's favorites.</summary>
public class TeamInterestsService(IKickoffContext db)
{
    public Task<List<TeamInterestDto>> ListAsync(int userId, CancellationToken ct = default) =>
        db.UserTeamInterests
            .Where(i => i.UserId == userId)
            .OrderBy(i => i.Team.DisplayName)
            .Select(i => new TeamInterestDto(
                i.TeamId, i.Team.League, i.Team.DisplayName, i.Team.Abbreviation,
                i.Team.LogoUrl, i.Team.CurrentRank))
            .ToListAsync(ct);

    public async Task<bool> AddAsync(int userId, int teamId, CancellationToken ct = default)
    {
        if (!await db.Teams.AnyAsync(t => t.Id == teamId, ct)) return false;

        var exists = await db.UserTeamInterests.AnyAsync(
            i => i.UserId == userId && i.TeamId == teamId,
            ct);
        if (!exists)
        {
            db.UserTeamInterests.Add(new UserTeamInterest
            {
                UserId = userId,
                TeamId = teamId,
                CreatedUtc = DateTimeOffset.UtcNow,
            });
            await db.SaveChangesAsync(ct);
        }

        return true;
    }

    public async Task RemoveAsync(int userId, int teamId, CancellationToken ct = default)
    {
        var interest = await db.UserTeamInterests.FindAsync([userId, teamId], ct);
        if (interest is null) return;

        db.UserTeamInterests.Remove(interest);
        await db.SaveChangesAsync(ct);
    }
}
