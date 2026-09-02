using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kickoff.Api.Domain.Configurations;

public class ConferenceConfiguration : IEntityTypeConfiguration<Conference>
{
    public void Configure(EntityTypeBuilder<Conference> builder)
    {
        builder.Property(c => c.Name).HasMaxLength(80);
        builder.Property(c => c.ShortName).HasMaxLength(20);

        builder.HasIndex(c => new { c.League, c.Name }).IsUnique();
    }
}
