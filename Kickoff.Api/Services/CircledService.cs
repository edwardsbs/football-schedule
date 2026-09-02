using Kickoff.Api.Domain;
using Kickoff.Api.Services.Models;
using Microsoft.EntityFrameworkCore;

namespace Kickoff.Api.Services;

/// <summary>One-off "circled" games — the Upcoming list.</summary>
public class CircledService(IKickoffContext db)
{
    /// <summary>Circled games as spoiler-safe DTOs, soonest kickoff first.</summary>
    public Task<List<GameDto>> ListAsync(int userId, CancellationToken ct = default) =>
        db.Games
            .Where(g => db.CircledGames.Any(c => c.UserId == userId && c.GameId == g.Id))
            .OrderBy(g => g.KickoffUtc)
            .ToGameDtos(db, userId)
            .ToListAsync(ct);

    /// <summary>Circle a game (optionally with a note). Idempotent; false if no such game.</summary>
    public async Task<bool> CircleAsync(int userId, int gameId, string? note, CancellationToken ct = default)
    {
        if (!await db.Games.AnyAsync(g => g.Id == gameId, ct)) return false;

        var circle = await db.CircledGames.FindAsync([userId, gameId], ct);
        if (circle is null)
        {
            db.CircledGames.Add(new CircledGame
            {
                UserId = userId,
                GameId = gameId,
                CreatedUtc = DateTimeOffset.UtcNow,
                Note = note,
            });
        }
        else
        {
            circle.Note = note;
        }

        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task UncircleAsync(int userId, int gameId, CancellationToken ct = default)
    {
        var circle = await db.CircledGames.FindAsync([userId, gameId], ct);
        if (circle is null) return;

        db.CircledGames.Remove(circle);
        await db.SaveChangesAsync(ct);
    }
}
