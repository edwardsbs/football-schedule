using Kickoff.Api.Domain;
using Kickoff.Api.Services.Models;
using Microsoft.EntityFrameworkCore;

namespace Kickoff.Api.Services;

/// <summary>Persistent, user-scoped choices for the Game Day board.</summary>
public class GameDayService(IKickoffContext db)
{
    public async Task<GameDayBoardDto> GetAsync(int userId, CancellationToken ct = default)
    {
        var preferences = await db.GameDayPreferences
            .Where(p => p.UserId == userId)
            .OrderBy(p => p.GameId)
            .Select(p => new { p.GameId, p.IsExcluded })
            .ToListAsync(ct);

        return new GameDayBoardDto(
            preferences.Where(p => !p.IsExcluded).Select(p => p.GameId).ToArray(),
            preferences.Where(p => p.IsExcluded).Select(p => p.GameId).ToArray());
    }

    /// <summary>
    /// Applies one explicit board choice. Removing a normal selection deletes
    /// its row; removing an automatically included circled game stores an
    /// exclusion so it stays removed on every device.
    /// </summary>
    public async Task<GameDayBoardDto?> SetAsync(
        int userId,
        int gameId,
        bool watching,
        bool suppressAutomatic,
        CancellationToken ct = default)
    {
        if (!await db.Games.AnyAsync(g => g.Id == gameId, ct)) return null;

        var preference = await db.GameDayPreferences.FindAsync([userId, gameId], ct);
        if (watching || suppressAutomatic)
        {
            var now = DateTimeOffset.UtcNow;
            if (preference is null)
            {
                db.GameDayPreferences.Add(new GameDayPreference
                {
                    UserId = userId,
                    GameId = gameId,
                    IsExcluded = !watching,
                    CreatedUtc = now,
                    UpdatedUtc = now,
                });
            }
            else
            {
                preference.IsExcluded = !watching;
                preference.UpdatedUtc = now;
            }
        }
        else if (preference is not null)
        {
            db.GameDayPreferences.Remove(preference);
        }

        await db.SaveChangesAsync(ct);
        return await GetAsync(userId, ct);
    }

    /// <summary>
    /// One-time migration of browser-local choices. Existing server choices win
    /// conflicts, while selections from multiple old devices are combined.
    /// </summary>
    public async Task<GameDayBoardDto> ImportAsync(
        int userId,
        IReadOnlyCollection<int> watchedGameIds,
        IReadOnlyCollection<int> autoExcludedGameIds,
        CancellationToken ct = default)
    {
        var requestedIds = watchedGameIds
            .Concat(autoExcludedGameIds)
            .Where(id => id > 0)
            .Distinct()
            .ToArray();
        if (requestedIds.Length == 0) return await GetAsync(userId, ct);

        var validIds = await db.Games
            .Where(g => requestedIds.Contains(g.Id))
            .Select(g => g.Id)
            .ToHashSetAsync(ct);
        var existingIds = await db.GameDayPreferences
            .Where(p => p.UserId == userId && validIds.Contains(p.GameId))
            .Select(p => p.GameId)
            .ToHashSetAsync(ct);
        var watched = watchedGameIds.ToHashSet();
        var now = DateTimeOffset.UtcNow;

        foreach (var gameId in validIds.Where(id => !existingIds.Contains(id)))
        {
            db.GameDayPreferences.Add(new GameDayPreference
            {
                UserId = userId,
                GameId = gameId,
                IsExcluded = !watched.Contains(gameId),
                CreatedUtc = now,
                UpdatedUtc = now,
            });
        }

        await db.SaveChangesAsync(ct);
        return await GetAsync(userId, ct);
    }
}
