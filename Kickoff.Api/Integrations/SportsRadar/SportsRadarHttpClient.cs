using System.Text.Json;
using Kickoff.Api.Domain;
using Kickoff.Api.Integrations.SportsRadar.Contracts;
using Microsoft.Extensions.Options;

namespace Kickoff.Api.Integrations.SportsRadar;

/// <summary>
/// Real SportsRadar v7 REST client.
///
/// URL shape (documented and stable):
///   {baseUrl}/{sport}/official/{accessLevel}/v7/{locale}/games/{year}/{seasonType}/{week}/schedule.json?api_key=…
/// where sport is "nfl" or "ncaafb", seasonType is REG/PRE/PST.
///
/// ⚠️ The JSON field paths below are a best-effort mapping. Verify them against
/// an actual response for the account's tier before trusting live output — the
/// NFL and NCAAFB feeds differ slightly, and coverage (scores, clock, broadcast)
/// varies by tier. See the spec's open questions.
/// </summary>
public class SportsRadarHttpClient(
    HttpClient http,
    IOptions<SportsRadarOptions> options,
    ILogger<SportsRadarHttpClient> logger) : ISportsRadarClient
{
    private readonly SportsRadarOptions _opt = options.Value;

    public async Task<ScheduleFeed> GetWeekScheduleAsync(
        League league, int seasonYear, int week, CancellationToken ct = default)
    {
        var url = BuildUrl(league, $"games/{seasonYear}/{_opt.SeasonType}/{week}/schedule.json");
        using var doc = await GetJsonAsync(url, ct);

        var games = new List<FeedGame>();
        if (doc is not null && TryGetGamesArray(doc.RootElement, out var arr))
        {
            foreach (var g in arr.EnumerateArray())
            {
                if (TryParseGame(g, out var game)) games.Add(game);
            }
        }

        return new ScheduleFeed(league, seasonYear, week, games);
    }

    public async Task<IReadOnlyList<GameScoreUpdate>> GetLiveScoresAsync(
        League league, CancellationToken ct = default)
    {
        // Poll the configured current week's boxscore and keep only live/closed lines.
        // A higher tier's push feed would replace this; wire it here when available.
        var url = BuildUrl(league, $"games/{_opt.CurrentSeasonYear}/{_opt.SeasonType}/{_opt.CurrentWeek}/boxscore.json");
        using var doc = await GetJsonAsync(url, ct);

        var updates = new List<GameScoreUpdate>();
        if (doc is not null && TryGetGamesArray(doc.RootElement, out var arr))
        {
            foreach (var g in arr.EnumerateArray())
            {
                if (!TryParseGame(g, out var game)) continue;
                if (game.Status is GameStatus.InProgress or GameStatus.Halftime or GameStatus.Final
                    && game.Score is not null)
                {
                    updates.Add(new GameScoreUpdate(game.ExternalId, game.Status, game.Score));
                }
            }
        }

        return updates;
    }

    private string BuildUrl(League league, string path)
    {
        var sport = league == League.Nfl ? "nfl" : "ncaafb";
        return $"{_opt.BaseUrl.TrimEnd('/')}/{sport}/official/{_opt.AccessLevel}/v7/{_opt.Locale}/{path}" +
               $"?api_key={_opt.ApiKey}";
    }

    private async Task<JsonDocument?> GetJsonAsync(string url, CancellationToken ct)
    {
        try
        {
            using var resp = await http.GetAsync(url, ct);
            if (!resp.IsSuccessStatusCode)
            {
                logger.LogWarning("SportsRadar {Status} for {Url}", (int)resp.StatusCode, Redact(url));
                return null;
            }

            await using var stream = await resp.Content.ReadAsStreamAsync(ct);
            return await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "SportsRadar request failed for {Url}", Redact(url));
            return null;
        }
    }

    private string Redact(string url) =>
        string.IsNullOrEmpty(_opt.ApiKey) ? url : url.Replace(_opt.ApiKey, "***");

    // --- JSON mapping (verify field paths against a real response) ---

    private static bool TryGetGamesArray(JsonElement root, out JsonElement games)
    {
        // Schedule: { "week": { "games": [...] } }; some feeds put "games" at root.
        if (root.TryGetProperty("week", out var wk) && wk.TryGetProperty("games", out games))
            return true;
        if (root.TryGetProperty("games", out games))
            return true;
        games = default;
        return false;
    }

    private static bool TryParseGame(JsonElement g, out FeedGame game)
    {
        game = null!;
        if (!g.TryGetProperty("id", out var idEl)) return false;
        var id = idEl.GetString();
        if (string.IsNullOrEmpty(id)) return false;

        var kickoff = g.TryGetProperty("scheduled", out var s) && s.TryGetDateTimeOffset(out var k)
            ? k : DateTimeOffset.MinValue;

        var status = MapStatus(g.TryGetProperty("status", out var st) ? st.GetString() : null);
        var home = ParseTeam(g, "home");
        var away = ParseTeam(g, "away");
        if (home is null || away is null) return false;

        var venue = g.TryGetProperty("venue", out var v) && v.TryGetProperty("name", out var vn)
            ? vn.GetString() : null;

        var broadcasts = new List<string>();
        if (g.TryGetProperty("broadcast", out var b) && b.TryGetProperty("network", out var net)
            && net.GetString() is { Length: > 0 } network)
            broadcasts.Add(network);

        ScoreSnapshot? score = null;
        if (g.TryGetProperty("scoring", out var sc))
        {
            var homePts = sc.TryGetProperty("home_points", out var hp) ? hp.GetInt32() : 0;
            var awayPts = sc.TryGetProperty("away_points", out var ap) ? ap.GetInt32() : 0;
            var period = g.TryGetProperty("quarter", out var q) && q.TryGetInt32(out var qq) ? qq : (int?)null;
            var clock = g.TryGetProperty("clock", out var c) ? c.GetString() : null;
            score = new ScoreSnapshot(homePts, awayPts, period, clock, null);
        }

        game = new FeedGame(id, kickoff, home, away, status, venue, broadcasts, score);
        return true;
    }

    private static FeedTeam? ParseTeam(JsonElement g, string side)
    {
        if (!g.TryGetProperty(side, out var t) || !t.TryGetProperty("id", out var idEl)) return null;
        var id = idEl.GetString();
        if (string.IsNullOrEmpty(id)) return null;

        var market = t.TryGetProperty("market", out var m) ? m.GetString() ?? "" : "";
        var name = t.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
        var alias = t.TryGetProperty("alias", out var a) ? a.GetString() ?? "" : "";
        return new FeedTeam(id, market, name, $"{market} {name}".Trim(), alias);
    }

    private static GameStatus MapStatus(string? raw) => raw?.ToLowerInvariant() switch
    {
        "inprogress" => GameStatus.InProgress,
        "halftime" => GameStatus.Halftime,
        "closed" or "complete" or "final" => GameStatus.Final,
        "postponed" => GameStatus.Postponed,
        "cancelled" or "canceled" => GameStatus.Canceled,
        _ => GameStatus.Scheduled,
    };
}
