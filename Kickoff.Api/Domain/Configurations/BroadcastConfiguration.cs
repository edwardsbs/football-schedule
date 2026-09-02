using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kickoff.Api.Domain.Configurations;

public class BroadcastConfiguration : IEntityTypeConfiguration<Broadcast>
{
    public void Configure(EntityTypeBuilder<Broadcast> builder)
    {
        builder.Property(b => b.Network).HasMaxLength(40);

        builder.HasIndex(b => new { b.GameId, b.Network }).IsUnique();
    }
}
