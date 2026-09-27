using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kickoff.Api.Domain.Configurations;

public class GameDayPreferenceConfiguration : IEntityTypeConfiguration<GameDayPreference>
{
    public void Configure(EntityTypeBuilder<GameDayPreference> builder)
    {
        builder.HasKey(p => new { p.UserId, p.GameId });

        builder.HasOne(p => p.User)
            .WithMany(u => u.GameDayPreferences)
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(p => p.Game)
            .WithMany()
            .HasForeignKey(p => p.GameId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
