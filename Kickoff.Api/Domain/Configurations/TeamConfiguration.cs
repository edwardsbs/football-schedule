using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kickoff.Api.Domain.Configurations;

public class TeamConfiguration : IEntityTypeConfiguration<Team>
{
    public void Configure(EntityTypeBuilder<Team> builder)
    {
        builder.Property(t => t.Location).HasMaxLength(80);
        builder.Property(t => t.Name).HasMaxLength(80);
        builder.Property(t => t.DisplayName).HasMaxLength(120);
        builder.Property(t => t.Abbreviation).HasMaxLength(10);
        builder.Property(t => t.PrimaryColor).HasMaxLength(9);   // "#RRGGBBAA"
        builder.Property(t => t.ExternalId).HasMaxLength(64);

        // Upsert key for the sports-data provider sync; filtered so many nulls stay
        // allowed. Scoped by League, not ExternalId alone -- ESPN's NFL and NCAA
        // team ids are not in a shared namespace and can collide (verified: an
        // NFL team's id overwrote an NCAA team's display fields via the naive
        // global-uniqueness assumption this used to have).
        builder.HasIndex(t => new { t.League, t.ExternalId })
            .IsUnique()
            .HasFilter("[ExternalId] IS NOT NULL");

        builder.HasOne(t => t.Conference)
            .WithMany(c => c.Teams)
            .HasForeignKey(t => t.ConferenceId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(t => t.Division)
            .WithMany(d => d.Teams)
            .HasForeignKey(t => t.DivisionId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
