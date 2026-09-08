namespace Kickoff.Api.Integrations.SportsData;

public enum SportsDataProvider
{
    /// <summary>Generates and advances fake live games — no network access required.</summary>
    Simulated,

    /// <summary>ESPN's public (unofficial, keyless) scoreboard endpoints.</summary>
    Espn,
}

/// <summary>Bound from the "SportsData" configuration section.</summary>
public class SportsDataOptions
{
    public const string SectionName = "SportsData";

    /// <summary>Which client implementation to use.</summary>
    public SportsDataProvider Provider { get; set; } = SportsDataProvider.Simulated;

    /// <summary>Season segment used when importing a schedule: REG, PRE, or PST.</summary>
    public string SeasonType { get; set; } = "REG";

    /// <summary>Whether the background live-score poller runs.</summary>
    public bool LiveSyncEnabled { get; set; } = true;

    /// <summary>Seconds between live-score polls.</summary>
    public int LivePollSeconds { get; set; } = 20;

    /// <summary>Leagues to poll for live scores.</summary>
    public string[] LiveLeagues { get; set; } = ["Nfl", "Ncaa"];

    /// <summary>
    /// Minutes a live game's persisted scoreboard may remain unchanged before
    /// the poller verifies it through the provider's per-game endpoint.
    /// </summary>
    public double StaleGameMinutes { get; set; } = 10;

    /// <summary>Seconds between stale-game reconciliation passes.</summary>
    public int StaleRecoverySeconds { get; set; } = 60;

    /// <summary>
    /// Whether the background schedule-refresh sync runs. Catches flex
    /// scheduling -- kickoff time and broadcast changes ESPN publishes
    /// mid-season -- that the live-score poller doesn't touch.
    /// </summary>
    public bool ScheduleSyncEnabled { get; set; } = true;

    /// <summary>Hours between full schedule-refresh passes.</summary>
    public double ScheduleSyncHours { get; set; } = 24;
}
