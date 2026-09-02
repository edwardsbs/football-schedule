namespace Kickoff.Api.Domain;

/// <summary>
/// A single league's season for a given year. NCAA and NFL each get their own
/// Season rows — the app merges the two leagues at query time, not in the schema.
/// </summary>
public class Season
{
    public int Id { get; set; }
    public League League { get; set; }
    public int Year { get; set; }               // e.g. 2026
    public string Name { get; set; } = "";      // "2026 NFL Season"
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }

    public ICollection<Week> Weeks { get; set; } = [];
}
