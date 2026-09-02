using Kickoff.Api.Domain;
using Kickoff.Api.Integrations.SportsRadar.Contracts;

namespace Kickoff.Api.Integrations.SportsRadar;

/// <summary>
/// Provider seam for football data. Implemented by the real SportsRadar HTTP
/// client and by a simulator; the sync services depend only on this interface.
/// </summary>
public interface ISportsRadarClient
{
    /// <summary>Full schedule for one league / season / week.</summary>
    Task<ScheduleFeed> GetWeekScheduleAsync(
        League league, int seasonYear, int week, CancellationToken ct = default);

    /// <summary>
    /// Current lines for games that are live now, for the live-score poller.
    /// Returns only games with a meaningful update.
    /// </summary>
    Task<IReadOnlyList<GameScoreUpdate>> GetLiveScoresAsync(
        League league, CancellationToken ct = default);
}
