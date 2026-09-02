using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kickoff.Api.Domain.Configurations;

public class CircledGameConfiguration : IEntityTypeConfiguration<CircledGame>
{
    public void Configure(EntityTypeBuilder<CircledGame> builder)
    {
        builder.HasKey(c => new { c.UserId, c.GameId });

        builder.Property(c => c.Note).HasMaxLength(280);

        builder.HasOne(c => c.User)
            .WithMany(u => u.CircledGames)
            .HasForeignKey(c => c.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(c => c.Game)
            .WithMany()
            .HasForeignKey(c => c.GameId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
