using Kickoff.Api.Domain;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Kickoff.Api.Tests;

internal static class TestDb
{
    /// <summary>A fresh SQLite in-memory KickoffContext with the schema created.</summary>
    public static KickoffContext NewContext()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();
        var options = new DbContextOptionsBuilder<KickoffContext>()
            .UseSqlite(connection)
            .Options;
        var ctx = new KickoffContext(options);
        ctx.Database.EnsureCreated();
        return ctx;
    }
}

/// <summary>A TimeProvider whose "now" the test controls.</summary>
internal sealed class FakeTimeProvider(DateTimeOffset start) : TimeProvider
{
    private DateTimeOffset _now = start;

    public override DateTimeOffset GetUtcNow() => _now;

    public void Advance(TimeSpan by) => _now += by;
}
