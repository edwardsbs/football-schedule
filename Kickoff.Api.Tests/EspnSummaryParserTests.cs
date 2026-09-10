using System.Text.Json;
using Kickoff.Api.Integrations.SportsData;

namespace Kickoff.Api.Tests;

public class EspnSummaryParserTests
{
    [Fact]
    public void Parse_MapsLiveWinProbabilitySeries()
    {
        using var document = JsonDocument.Parse("""
        {
          "winprobability": [
            { "playId": "101", "homeWinPercentage": 0.48 },
            { "playId": "102", "homeWinPercentage": 0.63 }
          ]
        }
        """);

        var summary = EspnSummaryParser.Parse(document.RootElement, DateTimeOffset.UtcNow);

        Assert.Equal(0.63, summary.HomeWinProbability);
        Assert.Collection(summary.WinProbability,
            first =>
            {
                Assert.Equal(0, first.Sequence);
                Assert.Equal("101", first.PlayId);
                Assert.Equal(0.48, first.HomeWinPercentage);
            },
            second =>
            {
                Assert.Equal(1, second.Sequence);
                Assert.Equal("102", second.PlayId);
                Assert.Equal(0.63, second.HomeWinPercentage);
            });
    }

    [Fact]
    public void Parse_MapsAvailableInjuryReports()
    {
        using var document = JsonDocument.Parse("""
        {
          "injuries": [{
            "team": { "id": "12", "abbreviation": "KC" },
            "injuries": [{
              "status": "Questionable",
              "date": "2026-09-08T17:14Z",
              "athlete": {
                "displayName": "Patrick Mahomes",
                "position": { "abbreviation": "QB" },
                "headshot": { "href": "https://example.test/mahomes.png" }
              },
              "details": {
                "type": "Knee - ACL",
                "detail": "Surgery",
                "side": "Left",
                "returnDate": "2026-09-14"
              }
            }]
          }]
        }
        """);

        var summary = EspnSummaryParser.Parse(document.RootElement, DateTimeOffset.UtcNow);

        var report = Assert.Single(summary.Injuries);
        Assert.Equal("KC", report.TeamAbbreviation);
        var injury = Assert.Single(report.Injuries);
        Assert.Equal("Patrick Mahomes", injury.Athlete);
        Assert.Equal("QB", injury.Position);
        Assert.Equal("Questionable", injury.Status);
        Assert.Equal("Knee - ACL", injury.Type);
        Assert.Equal("Surgery", injury.Detail);
        Assert.Equal("Left", injury.Side);
        Assert.Equal("2026-09-14", injury.ReturnDate);
    }
}
