using Kickoff.Api.Domain;
using Kickoff.Api.Integrations.SportsData;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Kickoff.Api.Services.Sync;

/// <summary>
/// Background poller: every <see cref="SportsDataOptions.ScheduleSyncHours"/> it
/// re-pulls and re-upserts every week that hasn't fully concluded yet, so flex
/// scheduling (kickoff time / broadcast changes ESPN publishes mid-season) stays
/// current without a full manual re-import. Games already played are skipped --
/// the live-score poller already keeps those current. A singleton, so it opens a
/// DI scope per run to use the scoped context.
/// </summary>
public class ScheduleSyncWorker(
    IServiceScopeFactory scopeFactory,
    IOptions<SportsDataOptions> options,
    TimeProvider time,
    ILogger<ScheduleSyncWorker> logger) : BackgroundService
{
    private readonly SportsDataOptions _opt = options.Value;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_opt.ScheduleSyncEnabled)
        {
            logger.LogInformation("Schedule sync disabled.");
            return;
        }

        var leagues = LeagueListParser.Parse(_opt.LiveLeagues);
        logger.LogInformation(
            "Schedule sync started ({Provider}, every {Hours}h, leagues: {Leagues}).",
            _opt.Provider, _opt.ScheduleSyncHours, string.Join(", ", leagues));

        using var timer = new PeriodicTimer(TimeSpan.FromHours(Math.Max(1, _opt.ScheduleSyncHours)));
        do
        {
            try
            {
                await SyncOnceAsync(leagues, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Schedule sync failed; will retry next cycle.");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task SyncOnceAsync(IReadOnlyList<League> leagues, CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IKickoffContext>();
        var client = scope.ServiceProvider.GetRequiredService<ISportsDataClient>();
        var import = scope.ServiceProvider.GetRequiredService<ScheduleImportService>();
        var rankingsSync = scope.ServiceProvider.GetRequiredService<RankingsSyncService>();

        var now = time.GetUtcNow();
        var today = DateOnly.FromDateTime(now.UtcDateTime);
        var refreshFrom = now.AddDays(-7);

        foreach (var league in leagues)
        {
            if (league == League.Ncaa)
            {
                try
                {
                    var rankings = await client.GetCurrentRankingsAsync(league, ct);
                    var applied = await rankingsSync.ApplyAsync(league, rankings, ct);
                    logger.LogInformation("{League} current rankings sync: {Count} ranked teams.", league, applied);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "{League} current rankings sync failed.", league);
                }
            }

            // Prefer the stored week boundary, but also use game kickoffs so a
            // week whose dates were damaged by an old empty provider response
            // is selected and repairs itself on the next successful sync.
            var pendingWeeks = await db.Weeks
                .Where(w => w.Season.League == league
                    && w.Season.EndDate >= today
                    && (w.EndDate >= today || w.Games.Any(g => g.KickoffUtc >= refreshFrom)))
                .OrderBy(w => w.Number)
                .Select(w => new { w.Number, w.Season.Year })
                .ToListAsync(ct);

            foreach (var w in pendingWeeks)
            {
                try
                {
                    var feed = await client.GetWeekScheduleAsync(league, w.Year, w.Number, ct);
                    var result = await import.ImportAsync(feed, ct);
                    logger.LogInformation(
                        "{League} week {Week} schedule sync: {Added} added, {Updated} updated.",
                        league, w.Number, result.GamesAdded, result.GamesUpdated);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "{League} week {Week} schedule sync failed.", league, w.Number);
                }
            }
        }
    }
}
