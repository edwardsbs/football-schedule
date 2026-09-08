using Kickoff.Api.Domain;
using Kickoff.Api.Integrations.SportsData;
using Microsoft.Extensions.Options;

namespace Kickoff.Api.Services.Sync;

/// <summary>
/// Background poller: every <see cref="SportsDataOptions.LivePollSeconds"/> it
/// asks the provider for live lines in each configured league and applies them
/// via <see cref="ScoreSyncService"/>. A singleton, so it opens a DI scope per
/// tick to use the scoped context.
/// </summary>
public class LiveScoreSyncWorker(
    IServiceScopeFactory scopeFactory,
    IOptions<SportsDataOptions> options,
    TimeProvider timeProvider,
    ILogger<LiveScoreSyncWorker> logger) : BackgroundService
{
    private readonly SportsDataOptions _opt = options.Value;
    private readonly Dictionary<League, DateTimeOffset> _lastRecoveryUtc = [];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_opt.LiveSyncEnabled)
        {
            logger.LogInformation("Live score sync disabled.");
            return;
        }

        var leagues = LeagueListParser.Parse(_opt.LiveLeagues);
        logger.LogInformation(
            "Live score sync started ({Provider}, every {Seconds}s, leagues: {Leagues}).",
            _opt.Provider, _opt.LivePollSeconds, string.Join(", ", leagues));

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(Math.Max(5, _opt.LivePollSeconds)));
        do
        {
            try
            {
                await PollOnceAsync(leagues, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Live score poll failed; will retry next tick.");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task PollOnceAsync(IReadOnlyList<League> leagues, CancellationToken ct)
    {
        // One scope per tick: the simulator resolves to its shared singleton,
        // while a real typed-HttpClient client gets a fresh, factory-managed instance.
        using var scope = scopeFactory.CreateScope();
        var client = scope.ServiceProvider.GetRequiredService<ISportsDataClient>();
        var scores = scope.ServiceProvider.GetRequiredService<ScoreSyncService>();
        var recovery = scope.ServiceProvider.GetRequiredService<StaleGameRecoveryService>();

        foreach (var league in leagues)
        {
            var updates = await client.GetLiveScoresAsync(league, ct);
            if (updates.Count > 0)
            {
                var applied = await scores.ApplyAsync(league, updates, ct);
                logger.LogDebug("{League}: applied {Count} live update(s).", league, applied);
            }

            var now = timeProvider.GetUtcNow();
            var recoveryInterval = TimeSpan.FromSeconds(Math.Max(30, _opt.StaleRecoverySeconds));
            if (!_lastRecoveryUtc.TryGetValue(league, out var lastRecovery)
                || now - lastRecovery >= recoveryInterval)
            {
                _lastRecoveryUtc[league] = now;
                var result = await recovery.ReconcileAsync(league, ct);
                if (result.Checked > 0)
                {
                    logger.LogInformation(
                        "{League}: checked {Checked} stale live game(s), recovered {Recovered}.",
                        league, result.Checked, result.Recovered);
                }
            }
        }
    }
}
