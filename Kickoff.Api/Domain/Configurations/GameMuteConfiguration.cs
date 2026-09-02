using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kickoff.Api.Domain.Configurations;

public class GameMuteConfiguration : IEntityTypeConfiguration<GameMute>
{
    public void Configure(EntityTypeBuilder<GameMute> builder)
    {
        // At most one mute per user per game.
        builder.HasKey(m => new { m.UserId, m.GameId });

        builder.HasOne(m => m.User)
            .WithMany(u => u.Mutes)
            .HasForeignKey(m => m.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(m => m.Game)
            .WithMany()
            .HasForeignKey(m => m.GameId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
