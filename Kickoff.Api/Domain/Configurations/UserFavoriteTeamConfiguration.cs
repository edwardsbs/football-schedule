using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kickoff.Api.Domain.Configurations;

public class UserFavoriteTeamConfiguration : IEntityTypeConfiguration<UserFavoriteTeam>
{
    public void Configure(EntityTypeBuilder<UserFavoriteTeam> builder)
    {
        builder.HasKey(f => new { f.UserId, f.TeamId });

        builder.HasOne(f => f.User)
            .WithMany(u => u.FavoriteTeams)
            .HasForeignKey(f => f.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(f => f.Team)
            .WithMany()
            .HasForeignKey(f => f.TeamId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
