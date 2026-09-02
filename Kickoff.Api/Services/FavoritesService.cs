using Kickoff.Api.Domain;
using Kickoff.Api.Services.Models;
using Microsoft.EntityFrameworkCore;

namespace Kickoff.Api.Services;

/// <summary>Persistent team follows — the "My Teams" strip.</summary>
public class FavoritesService(IKickoffContext db)
{
    public Task<List<FavoriteTeamDto>> ListAsync(int userId, CancellationToken ct = default) =>
        db.UserFavoriteTeams
            .Where(f => f.UserId == userId)
            .OrderBy(f => f.Team.DisplayName)
            .Select(f => new FavoriteTeamDto(
                f.TeamId, f.Team.League, f.Team.DisplayName, f.Team.Abbreviation, f.Team.LogoUrl))
            .ToListAsync(ct);

    /// <summary>Follow a team. Idempotent; returns false if the team doesn't exist.</summary>
    public async Task<bool> AddAsync(int userId, int teamId, CancellationToken ct = default)
    {
        if (!await db.Teams.AnyAsync(t => t.Id == teamId, ct)) return false;

        var exists = await db.UserFavoriteTeams.AnyAsync(f => f.UserId == userId && f.TeamId == teamId, ct);
        if (!exists)
        {
            db.UserFavoriteTeams.Add(new UserFavoriteTeam
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
        var fav = await db.UserFavoriteTeams.FindAsync([userId, teamId], ct);
        if (fav is null) return;

        db.UserFavoriteTeams.Remove(fav);
        await db.SaveChangesAsync(ct);
    }
}
