namespace Kickoff.Api.Domain;

/// <summary>
/// A one-off matchup a user wants to track, independent of favorited teams.
/// Surfaces in the "Upcoming" list with a countdown. Keyed on (UserId, GameId).
/// </summary>
public class CircledGame
{
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public int GameId { get; set; }
    public Game Game { get; set; } = null!;

    public DateTimeOffset CreatedUtc { get; set; }
    public string? Note { get; set; }
}
