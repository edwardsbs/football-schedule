namespace Kickoff.Api.Domain;

/// <summary>
/// A network carrying a game. Modeled as a child collection because a game can
/// air on more than one outlet (national TV plus a streaming simulcast).
/// </summary>
public class Broadcast
{
    public int Id { get; set; }
    public int GameId { get; set; }
    public Game Game { get; set; } = null!;

    public string Network { get; set; } = "";   // "ABC", "ESPN", "Peacock"
    public bool IsStreaming { get; set; }
}
