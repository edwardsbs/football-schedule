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

    private sealed class RecordingHandler : HttpMessageHandler
    {
        public Uri? RequestUri { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            RequestUri = request.RequestUri;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{\"events\":[]}", Encoding.UTF8, "application/json"),
            });
        }
    }
}
