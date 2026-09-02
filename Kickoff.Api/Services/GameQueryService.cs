using Kickoff.Api.Domain;
using Kickoff.Api.Services.Models;
using Microsoft.EntityFrameworkCore;

namespace Kickoff.Api.Services;

/// <summary>
/// Read-side queries for games. Every method routes through
/// <see cref="GameProjections.ToGameDtos"/>, so all game reads are spoiler-safe
/// by construction. (Thin service for now; can be lifted into MediatR query
/// handlers to match the house CQRS pattern later.)
/// </summary>
public class GameQueryService(IKickoffContext db)
{
    /// <summary>Live dashboard: every in-progress game across both leagues.</summary>
    public Task<List<GameDto>> GetLiveAsync(int userId, CancellationToken ct = default) =>
        db.Games
            .Where(g => g.Status == GameStatus.InProgress || g.Status == GameStatus.Halftime)
            .OrderBy(g => g.KickoffUtc)
            .ToGameDtos(db, userId)
            .ToListAsync(ct);

    /// <summary>Merged timeline for a kickoff window (day or week view).</summary>
    public Task<List<GameDto>> GetByKickoffRangeAsync(
        int userId, DateTimeOffset fromUtc, DateTimeOffset toUtc, CancellationToken ct = default) =>
        db.Games
            .Where(g => g.KickoffUtc >= fromUtc && g.KickoffUtc < toUtc)
            .OrderBy(g => g.KickoffUtc)
            .ToGameDtos(db, userId)
            .ToListAsync(ct);

    public Task<GameDto?> GetByIdAsync(int gameId, int userId, CancellationToken ct = default) =>
        db.Games.Where(g => g.Id == gameId).ToGameDtos(db, userId).FirstOrDefaultAsync(ct);

    /// <summary>
    /// Full detail for one game, ignoring the mute for the score block only.
    /// Backs the deliberate press-and-hold reveal gesture.
    /// </summary>
    public Task<GameDto?> RevealAsync(int gameId, int userId, CancellationToken ct = default) =>
        db.Games.Where(g => g.Id == gameId).ToGameDtos(db, userId, revealMuted: true).FirstOrDefaultAsync(ct);
}
