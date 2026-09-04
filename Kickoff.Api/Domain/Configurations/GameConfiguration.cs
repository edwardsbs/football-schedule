using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kickoff.Api.Domain.Configurations;

public class GameConfiguration : IEntityTypeConfiguration<Game>
{
    public void Configure(EntityTypeBuilder<Game> builder)
    {
        builder.Property(g => g.Clock).HasMaxLength(10);
        builder.Property(g => g.DownDistance).HasMaxLength(32);
        builder.Property(g => g.ExternalId).HasMaxLength(64);

        // Upsert key for the sports-data provider's score sync. Scoped by League
        // for the same reason as Team's index -- don't assume the provider's
        // external ids are unique across leagues even if collisions are less
        // likely here (ESPN's event ids are large sequential numbers).
        builder.HasIndex(g => new { g.League, g.ExternalId })
            .IsUnique()
            .HasFilter("[ExternalId] IS NOT NULL");

        // Drives the merged timeline and live dashboard queries.
        builder.HasIndex(g => new { g.KickoffUtc, g.League });
        builder.HasIndex(g => g.Status);

        builder.HasOne(g => g.Week)
            .WithMany(w => w.Games)
            .HasForeignKey(g => g.WeekId)
            .OnDelete(DeleteBehavior.Cascade);

        // Two FKs to Team: Restrict on both to avoid SQL Server's
        // multiple-cascade-path error and to keep game history intact.
        builder.HasOne(g => g.HomeTeam)
            .WithMany()
            .HasForeignKey(g => g.HomeTeamId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(g => g.AwayTeam)
            .WithMany()
            .HasForeignKey(g => g.AwayTeamId)
            .OnDelete(DeleteBehavior.Restrict);

        // Possession is a bare FK (no navigation) and must never cascade.
        builder.HasOne<Team>()
            .WithMany()
            .HasForeignKey(g => g.PossessionTeamId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(g => g.Venue)
            .WithMany()
            .HasForeignKey(g => g.VenueId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(g => g.Broadcasts)
            .WithOne(b => b.Game)
            .HasForeignKey(b => b.GameId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
