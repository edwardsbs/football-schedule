using Kickoff.Api.Domain;
using Kickoff.Api.Integrations.SportsRadar.Contracts;
using Microsoft.EntityFrameworkCore;

namespace Kickoff.Api.Services.Sync;

/// <summary>
/// Applies live score lines to existing games, matched by external id. Only the
/// scoreboard block and status are touched — this is what the background poller
/// runs on every tick.
/// </summary>
public class ScoreSyncService(IKickoffContext db)
{
    public async Task<int> ApplyAsync(
        IReadOnlyList<GameScoreUpdate> updates, CancellationToken ct = default)
    {
        if (updates.Count == 0) return 0;

        var byExt = updates.ToDictionary(u => u.GameExternalId);
        var ids = byExt.Keys.ToList();

        var games = await db.Games
            .Where(g => g.ExternalId != null && ids.Contains(g.ExternalId))
            .ToListAsync(ct);

        var now = DateTimeOffset.UtcNow;
        foreach (var game in games)
        {
            var u = byExt[game.ExternalId!];
            game.Status = u.Status;
            game.HomeScore = u.Score.HomeScore;
            game.AwayScore = u.Score.AwayScore;
            game.Period = u.Score.Period;
            game.Clock = u.Score.Clock;
            game.HomeWinProbability = u.Score.HomeWinProbability;
            game.LastUpdatedUtc = now;
        }

        await db.SaveChangesAsync(ct);
        return games.Count;
    }
}
