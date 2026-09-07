using Kickoff.Api.Domain;
using Kickoff.Api.Integrations.SportsData;
using Kickoff.Api.Integrations.SportsData.Contracts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Kickoff.Api.Services;

public class GameSummaryService(
    IKickoffContext db,
    ISportsDataClient sportsData,
    IMemoryCache cache)
{
    public async Task<FeedGameSummary?> GetAsync(int gameId, CancellationToken ct = default)
    {
        var game = await db.Games
            .Where(g => g.Id == gameId)
            .Select(g => new { g.League, g.ExternalId, g.Status })
            .FirstOrDefaultAsync(ct);
        if (game?.ExternalId is not { Length: > 0 } externalId) return null;

        var key = $"game-summary:{game.League}:{externalId}";
        if (cache.TryGetValue<FeedGameSummary>(key, out var cached)) return cached;

        var summary = await sportsData.GetGameSummaryAsync(game.League, externalId, ct);
        if (summary is null) return null;

        var duration = game.Status is GameStatus.InProgress or GameStatus.Halftime
            ? TimeSpan.FromSeconds(8)
            : game.Status == GameStatus.Final
                ? TimeSpan.FromHours(12)
                : TimeSpan.FromMinutes(5);
        cache.Set(key, summary, duration);
        return summary;
    }
}
