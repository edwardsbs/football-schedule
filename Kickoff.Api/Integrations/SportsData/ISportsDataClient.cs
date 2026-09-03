using Kickoff.Api.Domain;
using Kickoff.Api.Integrations.SportsData.Contracts;

namespace Kickoff.Api.Integrations.SportsData;

/// <summary>
/// Provider seam for football data. Implemented by the real ESPN HTTP client and
/// by a simulator; the sync services depend only on this interface.
/// </summary>
public interface ISportsDataClient
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

    /// <summary>
    /// The full team roster for a league, independent of any schedule/week --
    /// lets team data (and real ids for favoriting) exist ahead of a team
    /// actually appearing in an imported game.
    /// </summary>
    Task<IReadOnlyList<FeedTeam>> GetAllTeamsAsync(League league, CancellationToken ct = default);
}
