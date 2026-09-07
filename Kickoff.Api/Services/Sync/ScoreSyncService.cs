using Kickoff.Api.Domain;
using Kickoff.Api.Integrations.SportsData.Contracts;
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
        League league, IReadOnlyList<GameScoreUpdate> updates, CancellationToken ct = default)
    {
        if (updates.Count == 0) return 0;

        var byExt = updates.ToDictionary(u => u.GameExternalId);
        var ids = byExt.Keys.ToList();
        var possessionExternalIds = updates
            .Select(u => u.Score.PossessionTeamExternalId)
            .OfType<string>()
            .Distinct()
            .ToList();

        // Scoped by league -- external ids are only unique within a league (see
        // Team/Game's composite index), so an unscoped lookup could otherwise
        // match a same-numbered game in the wrong league.
        var games = await db.Games
            .Where(g => g.League == league && g.ExternalId != null && ids.Contains(g.ExternalId))
            .ToListAsync(ct);

        var possessionTeamIds = await db.Teams
            .Where(t => t.League == league
                && t.ExternalId != null
                && possessionExternalIds.Contains(t.ExternalId))
            .ToDictionaryAsync(t => t.ExternalId!, t => t.Id, ct);

        var now = DateTimeOffset.UtcNow;
        foreach (var game in games)
        {
            var u = byExt[game.ExternalId!];
            var homeIncrease = game.HomeScore is { } oldHome ? u.Score.HomeScore - oldHome : 0;
            var awayIncrease = game.AwayScore is { } oldAway ? u.Score.AwayScore - oldAway : 0;
            var scoringSituation = u.Score.LastScoringPlay ?? InferScoringSituation(homeIncrease, awayIncrease);
            int? scoringTeamId = homeIncrease > 0 && awayIncrease <= 0
                ? game.HomeTeamId
                : awayIncrease > 0 && homeIncrease <= 0
                    ? game.AwayTeamId
                    : null;

            game.Status = u.Status;
            game.HomeScore = u.Score.HomeScore;
            game.AwayScore = u.Score.AwayScore;
            game.Period = u.Score.Period;
            game.Clock = u.Score.Clock;
            int? resolvedPossessionTeamId = u.Score.PossessionTeamExternalId is { } possessionExternalId
                && possessionTeamIds.TryGetValue(possessionExternalId, out var mappedPossessionTeamId)
                    ? mappedPossessionTeamId
                    : null;

            // ESPN briefly omits the whole situation block between plays, during
            // timeouts, and while changing quarters. Keep the last complete live
            // situation instead of making possession/down-and-distance flicker.
            // A real value replaces it immediately; non-live states clear it so a
            // final game can never retain a stale possession marker.
            if (u.Status is GameStatus.InProgress or GameStatus.Halftime)
            {
                if (scoringSituation is not null && scoringTeamId is not null)
                {
                    game.PossessionTeamId = scoringTeamId;
                    game.DownDistance = scoringSituation;
                }
                else
                {
                    if (resolvedPossessionTeamId is not null)
                        game.PossessionTeamId = resolvedPossessionTeamId;
                    if (!string.IsNullOrWhiteSpace(u.Score.DownDistance))
                        game.DownDistance = u.Score.DownDistance;
                }
            }
            else
            {
                game.PossessionTeamId = null;
                game.DownDistance = null;
            }
            game.HomeWinProbability = u.Score.HomeWinProbability;
            game.LastUpdatedUtc = now;
        }

        await db.SaveChangesAsync(ct);
        return games.Count;
    }

    private static string? InferScoringSituation(int homeIncrease, int awayIncrease)
    {
        if (homeIncrease > 0 && awayIncrease > 0) return null;
        var increase = Math.Max(homeIncrease, awayIncrease);
        if (increase == 3) return "Field Goal";
        if (increase >= 6) return "Touchdown";
        return null;
    }
}
