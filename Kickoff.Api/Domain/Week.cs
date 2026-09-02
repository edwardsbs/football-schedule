namespace Kickoff.Api.Domain;

/// <summary>
/// A week within a league's season (NCAA 1–15 + bowls, NFL 1–18 + playoffs).
/// The merged week/day views query <see cref="Game"/> by kickoff date range
/// across both leagues rather than joining a shared week.
/// </summary>
public class Week
{
    public int Id { get; set; }
    public int SeasonId { get; set; }
    public Season Season { get; set; } = null!;

    public int Number { get; set; }
    public string Label { get; set; } = "";     // "Week 1", "Bowls", "Wild Card"
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }

    public ICollection<Game> Games { get; set; } = [];
}
