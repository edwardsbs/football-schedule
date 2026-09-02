namespace Kickoff.Api.Domain;

/// <summary>
/// A division within a <see cref="Conference"/>: an NCAA conference's split
/// (SEC Eastern/Western, ACC Atlantic/Coastal) or an NFL division
/// (AFC East, NFC West). Optional — a conference may run without divisions,
/// in which case its teams carry a null <see cref="Team.DivisionId"/>.
/// </summary>
public class Division
{
    public int Id { get; set; }
    public int ConferenceId { get; set; }
    public Conference Conference { get; set; } = null!;

    public string Name { get; set; } = "";      // "Eastern" / "AFC East"
    public string ShortName { get; set; } = "";

    public ICollection<Team> Teams { get; set; } = [];
}
