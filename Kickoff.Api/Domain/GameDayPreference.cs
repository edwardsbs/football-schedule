namespace Kickoff.Api.Domain;

/// <summary>
/// A user's explicit Game Day choice for one game. A non-excluded row puts the
/// game on the board; an excluded row suppresses the board's automatic
/// inclusion of a circled game.
/// </summary>
public class GameDayPreference
{
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public int GameId { get; set; }
    public Game Game { get; set; } = null!;

    public bool IsExcluded { get; set; }
    public DateTimeOffset CreatedUtc { get; set; }
    public DateTimeOffset UpdatedUtc { get; set; }
}
