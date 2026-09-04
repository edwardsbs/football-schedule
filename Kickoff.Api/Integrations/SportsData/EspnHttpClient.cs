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
/// where sport is "nfl" or "college-football". NCAA's unfiltered scoreboard
/// silently returns only 25 featured events, so its live poll requests ESPN's
/// full FBS group instead; otherwise live games outside that first page stop
/// receiving score updates.
///
/// Schedule pulls differ by league: NFL's `week=` parameter reliably returns
/// the whole week (verified: identical to the equivalent date-range query).
/// NCAA's does not -- verified directly two ways: `week=1` returned 25 of a
/// real 99 games for that week (silently dropping the rest, no error), and
/// separately, ESPN's own calendar entry for that same week spans Aug 22 -
/// Sep 7 as ONE block -- which is actually two real-world weeks (fans' "Week
/// 0" and "Week 1"), confirmed by the fact that trusting it as one window
/// made several teams appear to play twice in what was supposedly a single
/// week. So NCAA schedule pulls query by date range using boundaries this
/// client computes itself (real Tuesday-Monday weeks, same convention as the
/// merged week view), anchored to the season's actual start date from ESPN's
/// calendar -- not ESPN's own (evidently unreliable) per-week calendar entries.
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
        string url;
        if (league == League.Ncaa)
        {
            var week0Start = await GetNcaaWeek0StartAsync(league, ct);
            if (week0Start is null)
            {
                logger.LogWarning("Could not resolve the NCAA season start date from ESPN's calendar.");
                return new ScheduleFeed(league, seasonYear, week, []);
            }
            var start = week0Start.Value.AddDays(7 * week);
            var end = start.AddDays(6);
            url = $"{BaseUrl}/{Sport(league)}/scoreboard?dates={start:yyyyMMdd}-{end:yyyyMMdd}";
        }
        else
        {
            var seasonType = MapSeasonType(_opt.SeasonType);
            url = $"{BaseUrl}/{Sport(league)}/scoreboard?seasontype={seasonType}&week={week}&dates={seasonYear}";
        }

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

    /// <summary>
    /// "Week 0"'s start date: the Tuesday on/after the regular season's own
    /// start date (ESPN's first "Regular Season" calendar entry) -- verified
    /// directly: season start is a Saturday (Aug 22), the real Week 0 slate
    /// (Aug 29-30) falls in the Tue-Mon window starting the following Tuesday
    /// (Aug 25), and that split leaves no team appearing twice within a week.
    /// </summary>
    private async Task<DateOnly?> GetNcaaWeek0StartAsync(League league, CancellationToken ct)
    {
        var url = $"{BaseUrl}/{Sport(league)}/scoreboard";
        using var doc = await GetJsonAsync(url, ct);
        if (doc is null) return null;

        if (!doc.RootElement.TryGetProperty("leagues", out var leagues) || leagues.GetArrayLength() == 0)
            return null;
        if (!leagues[0].TryGetProperty("calendar", out var calendar)) return null;

        foreach (var section in calendar.EnumerateArray())
        {
            if (!section.TryGetProperty("label", out var label) || label.GetString() != "Regular Season") continue;
            if (!section.TryGetProperty("entries", out var entries) || entries.GetArrayLength() == 0) continue;

            var first = entries[0];
            if (!first.TryGetProperty("startDate", out var s) || !s.TryGetDateTimeOffset(out var sd)) continue;

            var seasonStart = DateOnly.FromDateTime(sd.UtcDateTime);
            var daysUntilTuesday = ((int)DayOfWeek.Tuesday - (int)seasonStart.DayOfWeek + 7) % 7;
            return seasonStart.AddDays(daysUntilTuesday);
        }

        return null;
    }

    public async Task<IReadOnlyList<GameScoreUpdate>> GetLiveScoresAsync(
        League league, CancellationToken ct = default)
    {
        // ESPN's bare NCAA scoreboard is capped at 25 featured events. groups=80
        // returns the complete FBS slate (99 events in the live regression that
        // exposed this), after which we retain only live/final score updates.
        var group = league == League.Ncaa ? "?groups=80" : "";
        var url = $"{BaseUrl}/{Sport(league)}/scoreboard{group}";
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

        string? possessionTeamExternalId = null;
        string? downDistance = null;
        if (comp.TryGetProperty("situation", out var situation))
        {
            possessionTeamExternalId = situation.TryGetProperty("possession", out var possession)
                ? possession.GetString()
                : null;
            downDistance = situation.TryGetProperty("downDistanceText", out var fullDown)
                ? fullDown.GetString()
                : situation.TryGetProperty("shortDownDistanceText", out var shortDown)
                    ? shortDown.GetString()
                    : null;
        }

        // ESPN's scoreboard doesn't expose a win-probability field; leave null
        // (a future enhancement could pull it from the separate probabilities feed).
        return new ScoreSnapshot(
            home.Value,
            away.Value,
            period,
            clock,
            possessionTeamExternalId,
            downDistance,
            HomeWinProbability: null);
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
