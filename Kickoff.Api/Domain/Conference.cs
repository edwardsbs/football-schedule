namespace Kickoff.Api.Domain;

/// <summary>
/// A top-level league grouping: an NCAA conference (SEC, Big Ten) or an NFL
/// conference (AFC, NFC). Splits into <see cref="Division"/>s where the
/// conference uses them.
/// </summary>
public class Conference
{
    public int Id { get; set; }
    public League League { get; set; }
    public string Name { get; set; } = "";      // "SEC" / "AFC"
    public string ShortName { get; set; } = "";

    public ICollection<Division> Divisions { get; set; } = [];
    public ICollection<Team> Teams { get; set; } = [];
}
