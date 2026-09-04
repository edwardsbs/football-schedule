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
        Assert.Equal("3rd & 7", update.Score.DownDistance);
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
}
