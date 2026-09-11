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

    [Fact]
    public void Parse_MapsOffensiveAndDefensiveGameLeaders()
    {
        using var document = JsonDocument.Parse("""
        {
          "leaders": [{
            "team": { "id": "12", "abbreviation": "KC" },
            "leaders": [
              {
                "name": "passingYards",
                "displayName": "Passing Yards",
                "leaders": [{
                  "displayValue": "18/24, 245 YDS, 2 TD",
                  "athlete": { "displayName": "Test Quarterback", "position": { "abbreviation": "QB" } }
                }]
              },
              {
                "name": "totalTackles",
                "displayName": "Tackles",
                "leaders": [{ "displayValue": "8", "athlete": { "displayName": "Test Linebacker" } }]
              }
            ]
          }],
          "boxscore": {
            "players": [{
              "team": { "id": "12", "abbreviation": "KC" },
              "statistics": [
                {
                  "name": "defensive",
                  "keys": ["totalTackles", "soloTackles", "sacks", "tacklesForLoss", "passesDefended", "QBHits", "forcedFumbles"],
                  "athletes": [
                    { "athlete": { "displayName": "Test Linebacker" }, "stats": ["8", "5", "1", "2", "0", "1", "1"] },
                    { "athlete": { "displayName": "Test Corner" }, "stats": ["4", "3", "0", "0", "2", "0", "0"] }
                  ]
                },
                {
                  "name": "interceptions",
                  "keys": ["interceptions", "interceptionYards", "interceptionTouchdowns"],
                  "athletes": [
                    { "athlete": { "displayName": "Test Corner" }, "stats": ["1", "18", "0"] }
                  ]
                }
              ]
            }]
          }
        }
        """);

        var summary = EspnSummaryParser.Parse(document.RootElement, DateTimeOffset.UtcNow);

        var team = Assert.Single(summary.Leaders);
        Assert.Contains(team.Leaders, leader =>
            leader.Category == "passingYards"
            && leader.Athlete == "Test Quarterback"
            && leader.DisplayValue == "18/24, 245 YDS, 2 TD");
        Assert.DoesNotContain(team.Leaders, leader => leader.Category == "totalTackles");

        var defense = team.Leaders.Where(leader => leader.Category.StartsWith("defensiveImpact:")).ToList();
        Assert.Equal(2, defense.Count);
        Assert.Equal("Test Linebacker", defense[0].Athlete);
        Assert.Contains("8 TOT", defense[0].DisplayValue);
        Assert.Contains("1 SACK", defense[0].DisplayValue);
        Assert.Contains("2 TFL", defense[0].DisplayValue);
        Assert.Contains("1 FF", defense[0].DisplayValue);
        Assert.Equal("Test Corner", defense[1].Athlete);
        Assert.Contains("1 INT", defense[1].DisplayValue);
    }
}
