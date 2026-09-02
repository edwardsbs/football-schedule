namespace Kickoff.Api.Domain;

/// <summary>
/// A persistent team follow. Backs the "My Teams" strip pinned to the top of
/// every schedule view. Keyed on (UserId, TeamId).
/// </summary>
public class UserFavoriteTeam
{
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public int TeamId { get; set; }
    public Team Team { get; set; } = null!;

    public DateTimeOffset CreatedUtc { get; set; }
}
