namespace Kickoff.Api.Integrations.SportsRadar;

public enum SportsRadarProvider
{
    /// <summary>Generates and advances fake live games — no API key required.</summary>
    Simulated,

    /// <summary>Real SportsRadar v7 REST feeds (needs a verified key + tier).</summary>
    SportsRadar,
}

/// <summary>Bound from the "SportsRadar" configuration section.</summary>
public class SportsRadarOptions
{
    public const string SectionName = "SportsRadar";

    /// <summary>Which client implementation to use.</summary>
    public SportsRadarProvider Provider { get; set; } = SportsRadarProvider.Simulated;

    /// <summary>API key — keep in user-secrets / env, never in source. Blank ⇒ forces the simulator.</summary>
    public string? ApiKey { get; set; }

    /// <summary>Access level segment of the v7 URL: "trial" or "production".</summary>
    public string AccessLevel { get; set; } = "trial";

    public string Locale { get; set; } = "en";

    /// <summary>Base host for the REST feeds.</summary>
    public string BaseUrl { get; set; } = "https://api.sportradar.com";

    /// <summary>Whether the background live-score poller runs.</summary>
    public bool LiveSyncEnabled { get; set; } = true;

    /// <summary>Seconds between live-score polls. Keep ≥ the tier's QPS budget.</summary>
    public int LivePollSeconds { get; set; } = 20;

    /// <summary>Leagues to poll for live scores.</summary>
    public string[] LiveLeagues { get; set; } = ["Nfl", "Ncaa"];

    /// <summary>Season type segment of the v7 URL: REG, PRE, or PST.</summary>
    public string SeasonType { get; set; } = "REG";

    /// <summary>Season/week the live poller reads (real client only).</summary>
    public int CurrentSeasonYear { get; set; } = DateTime.UtcNow.Year;
    public int CurrentWeek { get; set; } = 1;
}
