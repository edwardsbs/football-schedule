namespace Kickoff.Api.Domain;

public class Team
{
    public int Id { get; set; }
    public League League { get; set; }

    public int? ConferenceId { get; set; }      // null = independent (e.g. Notre Dame)
    public Conference? Conference { get; set; }

    public int? DivisionId { get; set; }        // null = independent, or conference has no divisions
    public Division? Division { get; set; }

    public string Location { get; set; } = "";  // "Georgia" / "Kansas City"
    public string Name { get; set; } = "";      // "Bulldogs" / "Chiefs"
    public string DisplayName { get; set; } = "";
    public string Abbreviation { get; set; } = "";
    public string? PrimaryColor { get; set; }
    public string? LogoUrl { get; set; }
    public int? CurrentRank { get; set; }       // NCAA AP/curated Top 25; null = unranked

    /// <summary>Sports-data provider identifier; upsert key when syncing.</summary>
    public string? ExternalId { get; set; }
}
