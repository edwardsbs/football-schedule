using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kickoff.Api.Domain.Configurations;

public class WeekConfiguration : IEntityTypeConfiguration<Week>
{
    public void Configure(EntityTypeBuilder<Week> builder)
    {
        builder.Property(w => w.Label).HasMaxLength(50);

        // One row per week number within a season.
        builder.HasIndex(w => new { w.SeasonId, w.Number }).IsUnique();
    }
}
