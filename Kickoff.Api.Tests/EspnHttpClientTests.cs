using System.Net;
using System.Text;
using Kickoff.Api.Domain;
using Kickoff.Api.Integrations.SportsData;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Kickoff.Api.Tests;

public class EspnHttpClientTests
{
    [Fact]
    public async Task Ncaa_live_poll_requests_the_complete_fbs_scoreboard()
    {
        var handler = new RecordingHandler();
        var sut = new EspnHttpClient(
            new HttpClient(handler),
            Options.Create(new SportsDataOptions()),
            NullLogger<EspnHttpClient>.Instance);

        await sut.GetLiveScoresAsync(League.Ncaa);

        Assert.Equal(
            "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80",
            handler.RequestUri?.AbsoluteUri);
    }

    [Fact]
    public async Task Live_poll_maps_down_distance_and_possession()
    {
        const string json = """
            {
              "events": [{
                "id": "401856776",
                "date": "2026-09-04T00:00:00Z",
                "competitions": [{
                  "status": {
                    "period": 1,
                    "displayClock": "11:29",
                    "type": { "name": "STATUS_IN_PROGRESS", "state": "in", "completed": false }
                  },
                  "situation": {
                    "possession": "59",
                    "downDistanceText": "3rd & 7 at GT 42",
                    "shortDownDistanceText": "3rd & 7"
                  },
                  "competitors": [
                    {
                      "homeAway": "home",
                      "score": "7",
                      "team": { "id": "59", "displayName": "Georgia Tech", "abbreviation": "GT" }
                    },
                    {
                      "homeAway": "away",
                      "score": "0",
                      "team": { "id": "38", "displayName": "Colorado", "abbreviation": "COLO" }
                    }
                  ]
                }]
              }]
            }
            """;
        var handler = new RecordingHandler(json);
        var sut = new EspnHttpClient(
            new HttpClient(handler),
            Options.Create(new SportsDataOptions()),
            NullLogger<EspnHttpClient>.Instance);

        var update = Assert.Single(await sut.GetLiveScoresAsync(League.Ncaa));

        Assert.Equal("59", update.Score.PossessionTeamExternalId);
        Assert.Equal("3rd & 7 at GT 42", update.Score.DownDistance);
    }

    [Fact]
    public async Task Rankings_map_current_and_previous_ap_poll_positions()
    {
        const string json = """
            {
              "rankings": [
                {
                  "type": "coaches",
                  "ranks": [{ "current": 1, "previous": 2, "team": { "id": "ignored" } }]
                },
                {
                  "type": "ap",
                  "ranks": [
                    { "current": 3, "previous": 7, "team": { "id": "99" } },
                    { "current": 21, "previous": 0, "team": { "id": "101" } }
                  ]
                }
              ]
            }
            """;
        var handler = new RecordingHandler(json);
        var sut = new EspnHttpClient(
            new HttpClient(handler),
            Options.Create(new SportsDataOptions()),
            NullLogger<EspnHttpClient>.Instance);

        var rankings = await sut.GetCurrentRankingsAsync(League.Ncaa);

        Assert.Collection(
            rankings,
            first =>
            {
                Assert.Equal("99", first.TeamExternalId);
                Assert.Equal(3, first.Rank);
                Assert.Equal(7, first.PreviousRank);
            },
            second =>
            {
                Assert.Equal("101", second.TeamExternalId);
                Assert.Equal(21, second.Rank);
                Assert.Null(second.PreviousRank);
            });
    }

    [Fact]
    public async Task Weekly_rankings_read_the_archived_ap_poll_for_the_selected_week()
    {
        const string json = """
            {
              "name": "AP Top 25",
              "type": "ap",
              "date": "2025-09-21T07:00:00Z",
              "occurrence": { "number": 5, "displayValue": "Week 5" },
              "season": { "year": 2025 },
              "ranks": [
                {
                  "current": 1,
                  "previous": 2,
                  "team": {
                    "$ref": "http://sports.core.api.espn.com/v2/sports/football/leagues/college-football/seasons/2025/teams/333?lang=en&region=us"
                  }
                }
              ]
            }
            """;
        var handler = new RecordingHandler(json);
        var sut = new EspnHttpClient(
            new HttpClient(handler),
            Options.Create(new SportsDataOptions()),
            NullLogger<EspnHttpClient>.Instance);

        var poll = await sut.GetWeeklyRankingsAsync(League.Ncaa, 2025, 5);

        Assert.NotNull(poll);
        Assert.Equal("AP Top 25", poll.Name);
        Assert.Equal("Week 5", poll.Label);
        Assert.Equal(2025, poll.SeasonYear);
        Assert.Equal(5, poll.WeekNumber);
        Assert.False(poll.IsPreseason);
        Assert.Equal(2, Assert.Single(poll.Rankings).PreviousRank);
        Assert.Equal(
            "https://sports.core.api.espn.com/v2/sports/football/leagues/college-football/seasons/2025/types/2/weeks/5/rankings/1?lang=en&region=us",
            handler.RequestUri?.AbsoluteUri);
    }

    [Fact]
    public async Task Opening_week_rankings_use_the_preseason_archive()
    {
        const string json = """
            {
              "name": "AP Top 25",
              "occurrence": { "number": 1, "displayValue": "Preseason" },
              "season": { "year": 2026 },
              "ranks": [{ "current": 1, "previous": 0, "team": { "id": "194" } }]
            }
            """;
        var handler = new RecordingHandler(json);
        var sut = new EspnHttpClient(
            new HttpClient(handler),
            Options.Create(new SportsDataOptions()),
            NullLogger<EspnHttpClient>.Instance);

        var poll = await sut.GetWeeklyRankingsAsync(League.Ncaa, 2026, 1);

        Assert.True(poll?.IsPreseason);
        Assert.Contains("/types/1/weeks/1/rankings/1", handler.RequestUri?.AbsoluteUri);
    }

    [Fact]
    public async Task Per_game_score_reads_a_final_that_is_no_longer_on_the_current_scoreboard()
    {
        const string json = """
            {
              "header": {
                "competitions": [{
                  "status": {
                    "type": { "name": "STATUS_FINAL", "state": "post", "completed": true }
                  },
                  "competitors": [
                    { "homeAway": "home", "score": "24", "team": { "id": "52" } },
                    { "homeAway": "away", "score": "27", "team": { "id": "2567" } }
                  ]
                }]
              }
            }
            """;
        var handler = new RecordingHandler(json);
        var sut = new EspnHttpClient(
            new HttpClient(handler),
            Options.Create(new SportsDataOptions()),
            NullLogger<EspnHttpClient>.Instance);

        var update = await sut.GetGameScoreAsync(League.Ncaa, "401858212");

        Assert.NotNull(update);
        Assert.Equal(GameStatus.Final, update.Status);
        Assert.Equal(24, update.Score.HomeScore);
        Assert.Equal(27, update.Score.AwayScore);
        Assert.Equal(
            "https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=401858212",
            handler.RequestUri?.AbsoluteUri);
    }

    [Fact]
    public async Task Ncaa_schedule_maps_fcs_teams_from_the_current_group_tree()
    {
        const string calendarJson = """
            {
              "leagues": [{
                "calendar": [{
                  "label": "Regular Season",
                  "entries": [{ "startDate": "2026-08-22T00:00:00Z" }]
                }]
              }]
            }
            """;
        const string fcsGroupsJson = """
            {
              "items": [{
                "$ref": "http://sports.core.api.espn.com/v2/sports/football/leagues/college-football/seasons/2026/types/2/groups/32?lang=en&region=us"
              }]
            }
            """;
        const string scheduleJson = """
            {
              "events": [{
                "id": "fcs-test",
                "date": "2026-09-05T17:00:00Z",
                "competitions": [{
                  "status": { "type": { "name": "STATUS_SCHEDULED", "state": "pre", "completed": false } },
                  "competitors": [
                    {
                      "homeAway": "home",
                      "team": {
                        "id": "333", "displayName": "Alabama Crimson Tide",
                        "abbreviation": "ALA", "conferenceId": "8"
                      }
                    },
                    {
                      "homeAway": "away",
                      "team": {
                        "id": "2771", "displayName": "Merrimack Warriors",
                        "abbreviation": "MRMK", "conferenceId": "32"
                      }
                    }
                  ]
                }]
              }]
            }
            """;

        var handler = new RoutingHandler(uri =>
            uri.AbsoluteUri.Contains("/groups/81/children", StringComparison.Ordinal)
                ? fcsGroupsJson
                : uri.Query.Contains("dates=", StringComparison.Ordinal)
                    ? scheduleJson
                    : calendarJson);
        var sut = new EspnHttpClient(
            new HttpClient(handler),
            Options.Create(new SportsDataOptions()),
            NullLogger<EspnHttpClient>.Instance);

        var game = Assert.Single((await sut.GetWeekScheduleAsync(League.Ncaa, 2026, 1)).Games);

        Assert.True(game.Away.IsFcs);
        Assert.False(game.Home.IsFcs);
    }

    private sealed class RecordingHandler(string json = "{\"events\":[]}") : HttpMessageHandler
    {
        public Uri? RequestUri { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            RequestUri = request.RequestUri;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            });
        }
    }

    private sealed class RoutingHandler(Func<Uri, string> responseFor) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(responseFor(request.RequestUri!), Encoding.UTF8, "application/json"),
            });
    }
}
