using System.Text.Json;
using System.Globalization;
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
            ParseInjuries(root),
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

        foreach (var defense in ParseDefensiveLeaders(root))
        {
            var index = result.FindIndex(team => team.TeamExternalId == defense.TeamExternalId);
            if (index < 0)
            {
                result.Add(defense);
                continue;
            }

            // ESPN's top-level leader block sometimes contains only a tackle
            // leader (and an empty sacks row). Replace those shallow defensive
            // entries with the richer, player-box-score-derived impact lines.
            var offenseAndSpecialTeams = result[index].Leaders
                .Where(leader => !IsDefensiveLeaderCategory(leader.Category))
                .Concat(defense.Leaders)
                .ToList();
            result[index] = result[index] with { Leaders = offenseAndSpecialTeams };
        }

        return result;
    }

    private static List<FeedTeamLeaders> ParseDefensiveLeaders(JsonElement root)
    {
        if (!Object(root, "boxscore", out var boxscore)) return [];
        var result = new List<FeedTeamLeaders>();

        foreach (var teamEntry in Array(boxscore, "players"))
        {
            var teamId = NestedString(teamEntry, "team", "id");
            if (teamId is null) continue;

            var candidates = new Dictionary<string, DefensiveLeaderCandidate>(StringComparer.OrdinalIgnoreCase);
            foreach (var category in Array(teamEntry, "statistics"))
            {
                var categoryName = String(category, "name");
                if (categoryName is not ("defensive" or "interceptions" or "fumbles")) continue;

                var keys = Array(category, "keys")
                    .Select(value => value.ValueKind == JsonValueKind.String ? value.GetString() ?? "" : "")
                    .ToList();

                foreach (var row in Array(category, "athletes"))
                {
                    if (!Object(row, "athlete", out var athlete)) continue;
                    var athleteName = String(athlete, "displayName") ?? String(athlete, "shortName");
                    if (athleteName is null) continue;

                    if (!candidates.TryGetValue(athleteName, out var candidate))
                    {
                        candidate = new DefensiveLeaderCandidate(
                            athleteName,
                            NestedString(athlete, "position", "abbreviation"),
                            NestedString(athlete, "headshot", "href"));
                        candidates.Add(athleteName, candidate);
                    }

                    var values = Array(row, "stats")
                        .Select(value => value.ValueKind == JsonValueKind.String ? value.GetString() ?? "" : value.ToString())
                        .ToList();
                    for (var i = 0; i < Math.Min(keys.Count, values.Count); i++)
                    {
                        if (DefensiveStatLabel(categoryName, keys[i]) is not { } label) continue;
                        if (StatNumber(values[i]) is not { } number || number <= 0) continue;
                        candidate.Add(keys[i], label, values[i], number);
                    }
                }
            }

            var leaders = candidates.Values
                .Where(candidate => candidate.Stats.Count > 0)
                .OrderByDescending(candidate => candidate.ImpactScore)
                .ThenByDescending(candidate => candidate.Value("totalTackles"))
                .ThenBy(candidate => candidate.Athlete)
                .Take(3)
                .Select((candidate, index) => new FeedLeader(
                    $"defensiveImpact:{index}",
                    "Defense",
                    candidate.Athlete,
                    candidate.Position,
                    candidate.DisplayValue(),
                    candidate.HeadshotUrl))
                .ToList();

            if (leaders.Count > 0)
            {
                result.Add(new FeedTeamLeaders(
                    teamId,
                    NestedString(teamEntry, "team", "abbreviation") ?? "",
                    leaders));
            }
        }

        return result;
    }

    private static bool IsDefensiveLeaderCategory(string category) =>
        category.StartsWith("defensiveImpact:", StringComparison.OrdinalIgnoreCase)
        || category is "sacks" or "totalTackles" or "tacklesForLoss" or "interceptions" or "forcedFumbles";

    private static string? DefensiveStatLabel(string category, string key) => key switch
    {
        "totalTackles" => "TOT",
        "soloTackles" => "SOLO",
        "sacks" => "SACK",
        "tacklesForLoss" => "TFL",
        "passesDefended" => "PD",
        "QBHits" => "QBH",
        "hurries" => "HUR",
        "interceptions" when category == "interceptions" => "INT",
        "forcedFumbles" => "FF",
        "fumblesRecovered" when category == "fumbles" => "FR",
        "defensiveTouchdowns" or "interceptionTouchdowns" => "TD",
        _ => null,
    };

    private static double? StatNumber(string value) =>
        double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var number) ? number : null;

    private sealed class DefensiveLeaderCandidate(string athlete, string? position, string? headshotUrl)
    {
        private static readonly string[] DisplayOrder =
        [
            "totalTackles", "sacks", "tacklesForLoss", "interceptions", "forcedFumbles",
            "fumblesRecovered", "passesDefended", "QBHits", "hurries", "defensiveTouchdowns",
            "interceptionTouchdowns", "soloTackles",
        ];

        public string Athlete { get; } = athlete;
        public string? Position { get; } = position;
        public string? HeadshotUrl { get; } = headshotUrl;
        public Dictionary<string, (string Label, string DisplayValue, double Number)> Stats { get; } = [];

        public double ImpactScore =>
            Value("totalTackles")
            + 4 * Value("sacks")
            + 2 * Value("tacklesForLoss")
            + 1.5 * Value("passesDefended")
            + Value("QBHits")
            + Value("hurries")
            + 6 * Value("interceptions")
            + 4 * Value("forcedFumbles")
            + 4 * Value("fumblesRecovered")
            + 10 * (Value("defensiveTouchdowns") + Value("interceptionTouchdowns"));

        public void Add(string key, string label, string displayValue, double number) =>
            Stats[key] = (label, displayValue, number);

        public double Value(string key) => Stats.TryGetValue(key, out var stat) ? stat.Number : 0;

        public string DisplayValue()
        {
            var selected = DisplayOrder
                .Where(Stats.ContainsKey)
                .Where(key => key != "soloTackles" || !Stats.ContainsKey("totalTackles"))
                .Take(4)
                .Select(key => $"{Stats[key].DisplayValue} {Stats[key].Label}");
            return string.Join(" · ", selected);
        }
    }

    private static List<FeedTeamInjuries> ParseInjuries(JsonElement root)
    {
        var result = new List<FeedTeamInjuries>();
        foreach (var teamReport in Array(root, "injuries"))
        {
            var teamId = NestedString(teamReport, "team", "id");
            if (teamId is null) continue;

            var injuries = new List<FeedInjury>();
            foreach (var injury in Array(teamReport, "injuries"))
            {
                if (!Object(injury, "athlete", out var athlete)) continue;
                var athleteName = String(athlete, "displayName") ?? String(athlete, "fullName");
                if (athleteName is null) continue;
                var hasDetails = Object(injury, "details", out var details);

                injuries.Add(new FeedInjury(
                    athleteName,
                    NestedString(athlete, "position", "abbreviation"),
                    String(injury, "status") ?? NestedString(injury, "type", "description") ?? "Injury",
                    hasDetails ? String(details, "type") : null,
                    hasDetails ? SpecifiedValue(String(details, "detail")) : null,
                    hasDetails ? SpecifiedValue(String(details, "side")) : null,
                    Date(injury, "date"),
                    hasDetails ? String(details, "returnDate") : null,
                    NestedString(athlete, "headshot", "href")));
            }

            if (injuries.Count > 0)
            {
                result.Add(new FeedTeamInjuries(
                    teamId,
                    NestedString(teamReport, "team", "abbreviation") ?? "",
                    injuries));
            }
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

    private static string? SpecifiedValue(string? value) =>
        string.Equals(value, "Not Specified", StringComparison.OrdinalIgnoreCase) ? null : value;
}
