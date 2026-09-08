namespace Kickoff.Api.Domain;

/// <summary>
/// A team the user wants to monitor without promoting it to a favorite.
/// Keyed on (UserId, TeamId), independently of <see cref="UserFavoriteTeam"/>.
/// </summary>
public class UserTeamInterest
{
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public int TeamId { get; set; }
    public Team Team { get; set; } = null!;
    public DateTimeOffset CreatedUtc { get; set; }
}
