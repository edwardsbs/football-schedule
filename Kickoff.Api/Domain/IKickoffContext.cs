using Microsoft.EntityFrameworkCore;

namespace Kickoff.Api.Domain;

/// <summary>
/// Abstraction over <see cref="KickoffContext"/> so handlers depend on an
/// interface rather than the concrete DbContext.
/// </summary>
public interface IKickoffContext
{
    DbSet<Season> Seasons { get; }
    DbSet<Week> Weeks { get; }
    DbSet<Conference> Conferences { get; }
    DbSet<Division> Divisions { get; }
    DbSet<Team> Teams { get; }
    DbSet<Venue> Venues { get; }
    DbSet<Game> Games { get; }
    DbSet<Broadcast> Broadcasts { get; }
    DbSet<User> Users { get; }
    DbSet<UserFavoriteTeam> UserFavoriteTeams { get; }
    DbSet<CircledGame> CircledGames { get; }
    DbSet<GameMute> GameMutes { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
