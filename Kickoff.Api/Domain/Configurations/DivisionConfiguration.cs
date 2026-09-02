using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kickoff.Api.Domain.Configurations;

public class DivisionConfiguration : IEntityTypeConfiguration<Division>
{
    public void Configure(EntityTypeBuilder<Division> builder)
    {
        builder.Property(d => d.Name).HasMaxLength(60);
        builder.Property(d => d.ShortName).HasMaxLength(20);

        builder.HasIndex(d => new { d.ConferenceId, d.Name }).IsUnique();

        // NO ACTION (not Cascade): a Conference already reaches Team via a
        // SET NULL FK, so cascading Conference -> Division -> Team (SET NULL)
        // would give SQL Server two action paths to Team and be rejected.
        // Both of Team's FKs stay SET NULL; deleting a conference just requires
        // removing its divisions first.
        builder.HasOne(d => d.Conference)
            .WithMany(c => c.Divisions)
            .HasForeignKey(d => d.ConferenceId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
