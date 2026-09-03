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
}
