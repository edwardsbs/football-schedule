using System.Text.Json;
using Kickoff.Api.Domain;
using Kickoff.Api.Integrations.SportsData.Contracts;
using Microsoft.Extensions.Options;

namespace Kickoff.Api.Integrations.SportsData;

/// <summary>
/// Real client against ESPN's public site-API scoreboard endpoints
/// (site.api.espn.com — the same JSON ESPN.com and its apps consume). No API
/// key: it's an unofficial, undocumented surface, so treat it as best-effort —
/// keep parsing defensive and never let a shape change take down the poller.
///
/// URL shape: https://site.api.espn.com/apis/site/v2/sports/football/{sport}/scoreboard
/// where sport is "nfl" or "college-football". Schedule pulls add
/// ?seasontype=&week=&dates={year}; the live poll omits all three, which makes
/// ESPN default to "today" — no season/week config to keep in sync.
/// </summary>
public class EspnHttpClient(
    HttpClient http,
    IOptions<SportsDataOptions> options,
    ILogger<EspnHttpClient> logger) : ISportsDataClient
{
    private const string BaseUrl = "https://site.api.espn.com/apis/site/v2/sports/football";
    private readonly SportsDataOptions _opt = options.Value;

    public async Task<ScheduleFeed> GetWeekScheduleAsync(
        League league, int seasonYear, int week, CancellationToken ct = default)
    {
        var seasonType = MapSeasonType(_opt.SeasonType);
        var url = $"{BaseUrl}/{Sport(league)}/scoreboard?seasontype={seasonType}&week={week}&dates={seasonYear}";
        using var doc = await GetJsonAsync(url, ct);

        var games = new List<FeedGame>();
        if (doc is not null && doc.RootElement.TryGetProperty("events", out var events))
        {
            foreach (var e in events.EnumerateArray())
            {
                if (TryParseGame(e, out var game)) games.Add(game);
            }
        }

        return new ScheduleFeed(league, seasonYear, week, games);
    }

    public async Task<IReadOnlyList<GameScoreUpdate>> GetLiveScoresAsync(
        League league, CancellationToken ct = default)
    {
        // No date/week/seasontype params: ESPN defaults to "today", which tracks
        // whatever's actually being played without any season/week config.
        var url = $"{BaseUrl}/{Sport(league)}/scoreboard";
        using var doc = await GetJsonAsync(url, ct);

        var updates = new List<GameScoreUpdate>();
        if (doc is not null && doc.RootElement.TryGetProperty("events", out var events))
        {
            foreach (var e in events.EnumerateArray())
            {
                if (!TryParseGame(e, out var game)) continue;
                if (game.Status is GameStatus.InProgress or GameStatus.Halftime or GameStatus.Final
                    && game.Score is not null)
                {
                    updates.Add(new GameScoreUpdate(game.ExternalId, game.Status, game.Score));
                }
            }
        }

        return updates;
    }

    public async Task<IReadOnlyList<FeedTeam>> GetAllTeamsAsync(League league, CancellationToken ct = default)
    {
        var url = $"{BaseUrl}/{Sport(league)}/teams?limit=500";
        using var doc = await GetJsonAsync(url, ct);

        var teams = new List<FeedTeam>();
        if (doc is null) return teams;

        if (!doc.RootElement.TryGetProperty("sports", out var sports) || sports.GetArrayLength() == 0) return teams;
        if (!sports[0].TryGetProperty("leagues", out var leagues) || leagues.GetArrayLength() == 0) return teams;
        if (!leagues[0].TryGetProperty("teams", out var entries)) return teams;

        foreach (var entry in entries.EnumerateArray())
        {
            if (!entry.TryGetProperty("team", out var t) || !t.TryGetProperty("id", out var idEl)) continue;
            var id = idEl.GetString();
            if (string.IsNullOrEmpty(id)) continue;

            var location = t.TryGetProperty("location", out var loc) ? loc.GetString() ?? "" : "";
            var name = t.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
            var displayName = t.TryGetProperty("displayName", out var dn) ? dn.GetString() ?? $"{location} {name}".Trim() : $"{location} {name}".Trim();
            var abbr = t.TryGetProperty("abbreviation", out var ab) ? ab.GetString() ?? "" : "";

            string? logo = null;
            if (t.TryGetProperty("logos", out var logos))
            {
                foreach (var l in logos.EnumerateArray())
                {
                    if (!l.TryGetProperty("rel", out var rel)) continue;
                    if (!rel.EnumerateArray().Any(r => r.GetString() == "default")) continue;
                    logo = l.TryGetProperty("href", out var href) ? href.GetString() : null;
                    break;
                }
            }

            teams.Add(new FeedTeam(id, location, name, displayName, abbr, LogoUrl: logo));
        }

        return teams;
    }

    private static string Sport(League league) => league == League.Nfl ? "nfl" : "college-football";

    private static int MapSeasonType(string seasonType) => seasonType.ToUpperInvariant() switch
    {
        "PRE" => 1,
        "PST" => 3,
        _ => 2, // REG
    };

    private async Task<JsonDocument?> GetJsonAsync(string url, CancellationToken ct)
    {
        try
        {
            using var resp = await http.GetAsync(url, ct);
            if (!resp.IsSuccessStatusCode)
            {
                logger.LogWarning("ESPN {Status} for {Url}", (int)resp.StatusCode, url);
                return null;
            }

            await using var stream = await resp.Content.ReadAsStreamAsync(ct);
            return await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "ESPN request failed for {Url}", url);
            return null;
        }
    }

    // --- JSON mapping ---

    private static bool TryParseGame(JsonElement e, out FeedGame game)
    {
        game = null!;
        if (!e.TryGetProperty("id", out var idEl)) return false;
        var id = idEl.GetString();
        if (string.IsNullOrEmpty(id)) return false;

        var kickoff = e.TryGetProperty("date", out var d) && d.TryGetDateTimeOffset(out var k)
            ? k : DateTimeOffset.MinValue;

        if (!e.TryGetProperty("competitions", out var comps) || comps.GetArrayLength() == 0) return false;
        var comp = comps[0];

        var status = ParseStatus(comp);
        var home = ParseTeam(comp, "home");
        var away = ParseTeam(comp, "away");
        if (home is null || away is null) return false;

        var venue = comp.TryGetProperty("venue", out var v) && v.TryGetProperty("fullName", out var vn)
            ? vn.GetString() : null;

        var broadcasts = new List<string>();
        if (comp.TryGetProperty("broadcasts", out var bs))
        {
            foreach (var b in bs.EnumerateArray())
            {
                if (!b.TryGetProperty("names", out var names)) continue;
                foreach (var n in names.EnumerateArray())
                {
                    if (n.GetString() is { Length: > 0 } name) broadcasts.Add(name);
                }
            }
        }

        var score = ParseScore(comp, status);

        game = new FeedGame(id, kickoff, home, away, status, venue, broadcasts, score);
        return true;
    }

    private static FeedTeam? ParseTeam(JsonElement comp, string side)
    {
        if (!comp.TryGetProperty("competitors", out var competitors)) return null;

        foreach (var c in competitors.EnumerateArray())
        {
            if (!c.TryGetProperty("homeAway", out var ha) || ha.GetString() != side) continue;
            if (!c.TryGetProperty("team", out var t) || !t.TryGetProperty("id", out var idEl)) return null;

            var id = idEl.GetString();
            if (string.IsNullOrEmpty(id)) return null;

            var location = t.TryGetProperty("location", out var loc) ? loc.GetString() ?? "" : "";
            var name = t.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
            var displayName = t.TryGetProperty("displayName", out var dn) ? dn.GetString() ?? $"{location} {name}".Trim() : $"{location} {name}".Trim();
            var abbr = t.TryGetProperty("abbreviation", out var ab) ? ab.GetString() ?? "" : "";
            var logo = t.TryGetProperty("logo", out var lg) ? lg.GetString() : null;

            return new FeedTeam(id, location, name, displayName, abbr, LogoUrl: logo);
        }

        return null;
    }

    private static ScoreSnapshot? ParseScore(JsonElement comp, GameStatus status)
    {
        if (status == GameStatus.Scheduled) return null;
        if (!comp.TryGetProperty("competitors", out var competitors)) return null;

        int? home = null, away = null;
        foreach (var c in competitors.EnumerateArray())
        {
            if (!c.TryGetProperty("score", out var scoreEl)) continue;
            var raw = scoreEl.ValueKind == JsonValueKind.String ? scoreEl.GetString() : scoreEl.GetRawText();
            if (!int.TryParse(raw, out var points)) continue;

            var side = c.TryGetProperty("homeAway", out var ha) ? ha.GetString() : null;
            if (side == "home") home = points;
            else if (side == "away") away = points;
        }

        if (home is null || away is null) return null;

        var status2 = comp.TryGetProperty("status", out var st) ? st : default;
        var period = status2.ValueKind != JsonValueKind.Undefined && status2.TryGetProperty("period", out var p) && p.TryGetInt32(out var pp)
            ? pp : (int?)null;
        var clock = status2.ValueKind != JsonValueKind.Undefined && status2.TryGetProperty("displayClock", out var c2)
            ? c2.GetString() : null;

        // ESPN's scoreboard doesn't expose a win-probability field; leave null
        // (a future enhancement could pull it from the separate probabilities feed).
        return new ScoreSnapshot(home.Value, away.Value, period, clock, HomeWinProbability: null);
    }

    private static GameStatus ParseStatus(JsonElement comp)
    {
        if (!comp.TryGetProperty("status", out var status) || !status.TryGetProperty("type", out var type))
            return GameStatus.Scheduled;

        var name = type.TryGetProperty("name", out var n) ? n.GetString() : null;
        var state = type.TryGetProperty("state", out var s) ? s.GetString() : null;
        var completed = type.TryGetProperty("completed", out var c) && c.ValueKind == JsonValueKind.True;

        if (completed) return GameStatus.Final;

        return name?.ToUpperInvariant() switch
        {
            "STATUS_SCHEDULED" or "STATUS_PREGAME" => GameStatus.Scheduled,
            "STATUS_HALFTIME" => GameStatus.Halftime,
            "STATUS_IN_PROGRESS" or "STATUS_END_PERIOD" or "STATUS_DELAYED" or "STATUS_RAIN_DELAY" => GameStatus.InProgress,
            "STATUS_FINAL" or "STATUS_FULL_TIME" => GameStatus.Final,
            "STATUS_POSTPONED" => GameStatus.Postponed,
            "STATUS_CANCELED" or "STATUS_CANCELLED" => GameStatus.Canceled,
            _ => state switch
            {
                "in" => GameStatus.InProgress,
                "post" => GameStatus.Final,
                _ => GameStatus.Scheduled,
            },
        };
    }
}
