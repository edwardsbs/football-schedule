using Kickoff.Api.Domain;
using Kickoff.Api.Integrations.SportsData;
using Microsoft.Extensions.Options;

namespace Kickoff.Api.Services.Sync;

public record StaleGameRecoveryResult(int Checked, int Recovered);

/// <summary>
/// Reconciles locally live games whose scoreboards have stopped changing.
/// A provider's rolling scoreboard can omit yesterday's completed events, so
/// each candidate is re-read through the provider's per-game endpoint.
/// </summary>
public class StaleGameRecoveryService(
    ISportsDataClient client,
    ScoreSyncService scores,
    IOptions<SportsDataOptions> options,
    TimeProvider timeProvider,
    ILogger<StaleGameRecoveryService> logger)
{
    private readonly SportsDataOptions _options = options.Value;

    public async Task<StaleGameRecoveryResult> ReconcileAsync(
        League league, CancellationToken ct = default)
    {
        var staleAfter = TimeSpan.FromMinutes(Math.Max(1, _options.StaleGameMinutes));
        var staleBefore = timeProvider.GetUtcNow() - staleAfter;
        var candidates = await scores.GetStaleLiveGamesAsync(league, staleBefore, ct);
        var recovered = 0;

        foreach (var candidate in candidates)
        {
            try
            {
                var update = await client.GetGameScoreAsync(league, candidate.ExternalId, ct);
                if (update is null)
                {
                    logger.LogWarning(
                        "{League} game {ExternalId} is stale but its per-game score could not be loaded.",
                        league, candidate.ExternalId);
                    continue;
                }

                await scores.ApplyAsync(league, [update], ct);
                if (update.Status is not (GameStatus.InProgress or GameStatus.Halftime))
                {
                    recovered++;
                    logger.LogInformation(
                        "Recovered stale {League} game {ExternalId} as {Status}.",
                        league, candidate.ExternalId, update.Status);
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                logger.LogWarning(
                    ex,
                    "Failed to reconcile stale {League} game {ExternalId}; will retry later.",
                    league, candidate.ExternalId);
            }
        }

        return new StaleGameRecoveryResult(candidates.Count, recovered);
    }
}
