using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kickoff.Api.Domain.Configurations;

public class UserTeamInterestConfiguration : IEntityTypeConfiguration<UserTeamInterest>
{
    public void Configure(EntityTypeBuilder<UserTeamInterest> builder)
    {
        builder.HasKey(i => new { i.UserId, i.TeamId });

        builder.HasOne(i => i.User)
            .WithMany(u => u.TeamsOfInterest)
            .HasForeignKey(i => i.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(i => i.Team)
            .WithMany()
            .HasForeignKey(i => i.TeamId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
