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
