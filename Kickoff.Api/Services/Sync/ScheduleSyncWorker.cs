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

        var today = DateOnly.FromDateTime(time.GetUtcNow().UtcDateTime);

        foreach (var league in leagues)
        {
            // Only weeks that haven't fully concluded -- history doesn't need
            // re-pulling, which keeps the daily call count small.
            var pendingWeeks = await db.Weeks
                .Where(w => w.Season.League == league && w.EndDate >= today)
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
