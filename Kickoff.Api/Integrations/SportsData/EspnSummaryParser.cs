using System.Text.Json;
using Kickoff.Api.Integrations.SportsData.Contracts;

namespace Kickoff.Api.Integrations.SportsData;

/// <summary>
/// Defensive mapper for ESPN's undocumented per-game summary response. Missing
/// sections are normal across leagues, game states, and broadcast tiers.
/// </summary>
internal static class EspnSummaryParser
{
    public static FeedGameSummary Parse(JsonElement root, DateTimeOffset retrievedUtc)
    {
        var plays = AllDrivePlays(root).ToList();
        var lastPlay = plays.Count > 0 ? ParsePlay(plays[^1]) : null;
        var scoringPlays = Array(root, "scoringPlays").Select(ParsePlay).OfType<FeedPlay>().ToList();
        var probability = ParseWinProbability(root);

        return new FeedGameSummary(
            retrievedUtc,
            lastPlay,
            ParseCurrentDrive(root),
            scoringPlays,
            probability.Count > 0 ? probability[^1].HomeWinPercentage : null,
            probability,
            ParseTeamStatistics(root),
            ParseLeaders(root),
            ParseContext(root),
            ParseMarket(root),
            ParseStandings(root),
            ParseNews(root));
    }

    private static IEnumerable<JsonElement> AllDrivePlays(JsonElement root)
    {
        if (!Object(root, "drives", out var drives)) yield break;

        foreach (var drive in Array(drives, "previous"))
        foreach (var play in Array(drive, "plays"))
            yield return play;

        if (Object(drives, "current", out var current))
        foreach (var play in Array(current, "plays"))
            yield return play;
    }

    private static FeedPlay? ParsePlay(JsonElement play)
    {
        if (play.ValueKind != JsonValueKind.Object) return null;
        var start = Object(play, "start", out var startElement) ? ParseFieldPosition(startElement) : null;
        var end = Object(play, "end", out var endElement) ? ParseFieldPosition(endElement) : null;

        return new FeedPlay(
            String(play, "id"),
            String(play, "text") ?? String(play, "shortText"),
            NestedString(play, "type", "text"),
            NestedString(play, "team", "id"),
            NestedInt(play, "period", "number"),
            NestedString(play, "clock", "displayValue"),
            Bool(play, "scoringPlay"),
            Bool(play, "isTurnover"),
            Bool(play, "isPenalty"),
            Int(play, "scoreValue"),
            Int(play, "homeScore"),
            Int(play, "awayScore"),
            Int(play, "statYardage"),
            start,
            end);
    }

    private static FeedFieldPosition ParseFieldPosition(JsonElement field) => new(
        Int(field, "down"),
        Int(field, "distance"),
        Int(field, "yardLine"),
        Int(field, "yardsToEndzone"),
        String(field, "downDistanceText"),
        String(field, "possessionText"),
        NestedString(field, "team", "id"));

    private static FeedDrive? ParseCurrentDrive(JsonElement root)
    {
        if (!Object(root, "drives", out var drives) || !Object(drives, "current", out var drive)) return null;
        return new FeedDrive(
            NestedString(drive, "team", "id"),
            String(drive, "description"),
            String(drive, "displayResult"),
            NestedString(drive, "timeElapsed", "displayValue"),
            Int(drive, "plays") ?? Array(drive, "plays").Count(),
            Int(drive, "yards"),
            Bool(drive, "isScore"),
            Object(drive, "start", out var start) ? ParseFieldPosition(start) : null,
            Object(drive, "end", out var end) ? ParseFieldPosition(end) : null);
    }

    private static List<FeedWinProbabilityPoint> ParseWinProbability(JsonElement root)
    {
        var result = new List<FeedWinProbabilityPoint>();
        var sequence = 0;
        foreach (var point in Array(root, "winprobability"))
        {
            if (Double(point, "homeWinPercentage") is not { } percentage) continue;
            result.Add(new FeedWinProbabilityPoint(sequence++, String(point, "playId"), percentage));
        }
        return result;
    }

    private static List<FeedTeamStatistics> ParseTeamStatistics(JsonElement root)
    {
        if (!Object(root, "boxscore", out var boxscore)) return [];
        var result = new List<FeedTeamStatistics>();
        foreach (var entry in Array(boxscore, "teams"))
        {
            var id = NestedString(entry, "team", "id");
            if (id is null) continue;
            var stats = Array(entry, "statistics")
                .Select(stat => new FeedStatistic(
                    String(stat, "name") ?? "",
                    String(stat, "label") ?? String(stat, "name") ?? "",
                    String(stat, "displayValue") ?? ""))
                .Where(stat => stat.Label.Length > 0)
                .ToList();
            result.Add(new FeedTeamStatistics(
                id,
                NestedString(entry, "team", "abbreviation") ?? "",
                stats));
        }
        return result;
    }

    private static List<FeedTeamLeaders> ParseLeaders(JsonElement root)
    {
        var result = new List<FeedTeamLeaders>();
        foreach (var entry in Array(root, "leaders"))
        {
            var id = NestedString(entry, "team", "id");
            if (id is null) continue;
            var leaders = new List<FeedLeader>();
            foreach (var category in Array(entry, "leaders"))
            {
                var leader = Array(category, "leaders").FirstOrDefault();
                if (leader.ValueKind != JsonValueKind.Object || !Object(leader, "athlete", out var athlete)) continue;
                leaders.Add(new FeedLeader(
                    String(category, "name") ?? "",
                    String(category, "displayName") ?? String(category, "name") ?? "",
                    String(athlete, "displayName") ?? String(athlete, "shortName") ?? "",
                    NestedString(athlete, "position", "abbreviation"),
                    String(leader, "displayValue") ?? "",
                    NestedString(athlete, "headshot", "href")));
            }
            result.Add(new FeedTeamLeaders(
                id,
                NestedString(entry, "team", "abbreviation") ?? "",
                leaders));
        }
        return result;
    }

    private static FeedGameContext? ParseContext(JsonElement root)
    {
        if (!Object(root, "gameInfo", out var info)) return null;
        var hasVenue = Object(info, "venue", out var venue);
        var image = hasVenue ? Array(venue, "images").FirstOrDefault() : default;
        return new FeedGameContext(
            hasVenue ? String(venue, "fullName") : null,
            hasVenue ? NestedString(venue, "address", "city") : null,
            hasVenue ? NestedString(venue, "address", "state") : null,
            hasVenue ? NullableBool(venue, "grass") : null,
            Int(info, "attendance"),
            image.ValueKind == JsonValueKind.Object ? String(image, "href") : null);
    }

    private static FeedMarket? ParseMarket(JsonElement root)
    {
        var market = Array(root, "pickcenter").FirstOrDefault();
        if (market.ValueKind != JsonValueKind.Object) market = Array(root, "odds").FirstOrDefault();
        if (market.ValueKind != JsonValueKind.Object) return null;
        return new FeedMarket(
            NestedString(market, "provider", "name"),
            String(market, "details"),
            Double(market, "spread"),
            Double(market, "overUnder"),
            NestedInt(market, "homeTeamOdds", "moneyLine"),
            NestedInt(market, "awayTeamOdds", "moneyLine"));
    }

    private static List<FeedStandingsGroup> ParseStandings(JsonElement root)
    {
        if (!Object(root, "standings", out var standings)) return [];
        var result = new List<FeedStandingsGroup>();
        foreach (var group in Array(standings, "groups"))
        {
            if (!Object(group, "standings", out var table)) continue;
            var entries = new List<FeedStandingEntry>();
            foreach (var entry in Array(table, "entries"))
            {
                var id = String(entry, "id");
                var name = String(entry, "team");
                if (id is null || name is null) continue;
                entries.Add(new FeedStandingEntry(id, name, String(entry, "stats")?.Trim()));
            }
            result.Add(new FeedStandingsGroup(
                String(table, "header") ?? "Standings",
                String(table, "shortDivisionHeader"),
                entries));
        }
        return result;
    }

    private static List<FeedNewsItem> ParseNews(JsonElement root)
    {
        if (!Object(root, "news", out var news)) return [];
        var result = new List<FeedNewsItem>();
        foreach (var article in Array(news, "articles").Take(6))
        {
            var headline = String(article, "headline");
            if (headline is null) continue;
            result.Add(new FeedNewsItem(
                headline,
                String(article, "description"),
                Date(article, "published"),
                NestedString(article, "links", "web", "href"),
                Array(article, "images").FirstOrDefault() is var image && image.ValueKind == JsonValueKind.Object
                    ? String(image, "url")
                    : null));
        }
        return result;
    }

    private static IEnumerable<JsonElement> Array(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object
        && element.TryGetProperty(name, out var value)
        && value.ValueKind == JsonValueKind.Array
            ? value.EnumerateArray()
            : [];

    private static bool Object(JsonElement element, string name, out JsonElement value)
    {
        value = default;
        return element.ValueKind == JsonValueKind.Object
            && element.TryGetProperty(name, out value)
            && value.ValueKind == JsonValueKind.Object;
    }

    private static string? String(JsonElement element, string name)
    {
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(name, out var value)) return null;
        return value.ValueKind == JsonValueKind.String ? value.GetString() : null;
    }

    private static string? NestedString(JsonElement element, params string[] path)
    {
        if (path.Length == 0) return null;
        for (var i = 0; i < path.Length - 1; i++)
        {
            if (!Object(element, path[i], out element)) return null;
        }
        return String(element, path[^1]);
    }

    private static int? Int(JsonElement element, string name)
    {
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(name, out var value)) return null;
        if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number)) return number;
        return value.ValueKind == JsonValueKind.String && int.TryParse(value.GetString(), out number) ? number : null;
    }

    private static int? NestedInt(JsonElement element, params string[] path)
    {
        if (path.Length == 0) return null;
        for (var i = 0; i < path.Length - 1; i++)
        {
            if (!Object(element, path[i], out element)) return null;
        }
        return Int(element, path[^1]);
    }

    private static double? Double(JsonElement element, string name)
    {
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(name, out var value)) return null;
        if (value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var number)) return number;
        return value.ValueKind == JsonValueKind.String && double.TryParse(value.GetString(), out number) ? number : null;
    }

    private static bool Bool(JsonElement element, string name) => NullableBool(element, name) ?? false;

    private static bool? NullableBool(JsonElement element, string name)
    {
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(name, out var value)) return null;
        return value.ValueKind == JsonValueKind.True ? true : value.ValueKind == JsonValueKind.False ? false : null;
    }

    private static DateTimeOffset? Date(JsonElement element, string name) =>
        String(element, name) is { } raw && DateTimeOffset.TryParse(raw, out var date) ? date : null;
}
