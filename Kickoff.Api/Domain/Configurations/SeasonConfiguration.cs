using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kickoff.Api.Domain.Configurations;

public class SeasonConfiguration : IEntityTypeConfiguration<Season>
{
    public void Configure(EntityTypeBuilder<Season> builder)
    {
        builder.Property(s => s.Name).HasMaxLength(100);

        // One season per league per year.
        builder.HasIndex(s => new { s.League, s.Year }).IsUnique();

        builder.HasMany(s => s.Weeks)
            .WithOne(w => w.Season)
            .HasForeignKey(w => w.SeasonId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
