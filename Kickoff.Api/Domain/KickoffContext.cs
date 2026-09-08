using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Kickoff.Api.Domain;

public class KickoffContext(DbContextOptions<KickoffContext> options)
    : DbContext(options), IKickoffContext
{
    public const string Schema = "kickoff";

    public DbSet<Season> Seasons => Set<Season>();
    public DbSet<Week> Weeks => Set<Week>();
    public DbSet<Conference> Conferences => Set<Conference>();
    public DbSet<Division> Divisions => Set<Division>();
    public DbSet<Team> Teams => Set<Team>();
    public DbSet<Venue> Venues => Set<Venue>();
    public DbSet<Game> Games => Set<Game>();
    public DbSet<Broadcast> Broadcasts => Set<Broadcast>();
    public DbSet<User> Users => Set<User>();
    public DbSet<UserFavoriteTeam> UserFavoriteTeams => Set<UserFavoriteTeam>();
    public DbSet<UserTeamInterest> UserTeamInterests => Set<UserTeamInterest>();
    public DbSet<CircledGame> CircledGames => Set<CircledGame>();
    public DbSet<GameMute> GameMutes => Set<GameMute>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(KickoffContext).Assembly);

        // SQLite (the test provider) can't order/compare DateTimeOffset natively.
        // Store it in an order-preserving binary form there; SQL Server is untouched.
        if (Database.ProviderName?.Contains("Sqlite", StringComparison.Ordinal) == true)
        {
            var converter = new DateTimeOffsetToBinaryConverter();
            foreach (var property in modelBuilder.Model.GetEntityTypes()
                         .SelectMany(t => t.GetProperties())
                         .Where(p => p.ClrType == typeof(DateTimeOffset) || p.ClrType == typeof(DateTimeOffset?)))
            {
                property.SetValueConverter(converter);
            }
        }
    }
}
