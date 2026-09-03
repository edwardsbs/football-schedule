using System.Collections.Concurrent;
using Kickoff.Api.Domain;
using Kickoff.Api.Integrations.SportsData.Contracts;

namespace Kickoff.Api.Integrations.SportsData;

/// <summary>
/// Deterministic-ish football simulator. Generates a week's schedule from a
/// small built-in roster and advances in-progress games on every live poll —
/// scores tick up, the clock winds down, quarters roll over, games go final.
/// Registered as a singleton so state survives across requests and the poller.
/// Lets the whole stack show live data with no network access at all.
/// </summary>
public class SimulatedSportsDataClient : ISportsDataClient
{
    private readonly ConcurrentDictionary<string, SimGame> _games = new();
    private readonly TimeProvider _time;

    public SimulatedSportsDataClient(TimeProvider? time = null) => _time = time ?? TimeProvider.System;

    public Task<ScheduleFeed> GetWeekScheduleAsync(
        League league, int seasonYear, int week, CancellationToken ct = default)
    {
        var roster = league == League.Nfl ? NflTeams : NcaaTeams;
        var now = _time.GetUtcNow();
        var games = new List<FeedGame>();

        // Pair teams 0v1, 2v3, ... and stagger kickoffs around "now" so some
        // games are already live the moment a schedule is imported.
        for (var i = 0; i + 1 < roster.Length; i += 2)
        {
            var home = roster[i];
            var away = roster[i + 1];
            var externalId = $"sim-{league}-{seasonYear}-w{week}-{home.Abbreviation}-{away.Abbreviation}".ToLowerInvariant();
            var kickoff = now.AddMinutes((i - 2) * 45); // some in the past (live), some upcoming

            var sim = _games.GetOrAdd(externalId, _ => SimGame.Create(league, externalId, home, away, kickoff, now));
            games.Add(sim.ToFeedGame());
        }

        return Task.FromResult(new ScheduleFeed(league, seasonYear, week, games));
    }

    public Task<IReadOnlyList<GameScoreUpdate>> GetLiveScoresAsync(
        League league, CancellationToken ct = default)
    {
        var now = _time.GetUtcNow();
        var updates = new List<GameScoreUpdate>();

        foreach (var sim in _games.Values.Where(g => g.League == league))
        {
            var touched = sim.Advance(now);
            if (touched && sim.Status is GameStatus.InProgress or GameStatus.Final)
            {
                updates.Add(new GameScoreUpdate(sim.ExternalId, sim.Status, sim.Snapshot()));
            }
        }

        return Task.FromResult<IReadOnlyList<GameScoreUpdate>>(updates);
    }

    // --- internal simulation state ---

    private sealed class SimGame
    {
        private const int QuarterSeconds = 15 * 60;

        public required League League { get; init; }
        public required string ExternalId { get; init; }
        public required FeedTeam Home { get; init; }
        public required FeedTeam Away { get; init; }
        public required DateTimeOffset KickoffUtc { get; init; }
        public GameStatus Status { get; private set; }
        public int HomeScore { get; private set; }
        public int AwayScore { get; private set; }
        public int Period { get; private set; }
        public int SecondsLeftInPeriod { get; private set; }

        public static SimGame Create(
            League league, string externalId, FeedTeam home, FeedTeam away,
            DateTimeOffset kickoff, DateTimeOffset now)
        {
            var g = new SimGame
            {
                League = league,
                ExternalId = externalId,
                Home = home,
                Away = away,
                KickoffUtc = kickoff,
                Status = GameStatus.Scheduled,
                Period = 1,
                SecondsLeftInPeriod = QuarterSeconds,
            };
            if (kickoff <= now) g.Advance(now); // start (and partly play) already-kicked-off games
            return g;
        }

        /// <summary>Moves the game forward. Returns true if anything changed.</summary>
        public bool Advance(DateTimeOffset now)
        {
            if (Status == GameStatus.Final) return false;

            if (Status == GameStatus.Scheduled)
            {
                if (now < KickoffUtc) return false;
                Status = GameStatus.InProgress;
            }

            // Burn game clock proportional to elapsed wall-clock since kickoff,
            // compressed so a poll or two visibly moves the game.
            var elapsed = now - KickoffUtc;
            var targetElapsedGameSeconds = (int)Math.Min(4 * QuarterSeconds, elapsed.TotalSeconds * 8);
            var targetPeriod = Math.Min(4, targetElapsedGameSeconds / QuarterSeconds + 1);
            var targetSecondsLeft = QuarterSeconds - targetElapsedGameSeconds % QuarterSeconds;

            var changed = false;
            while (Period < targetPeriod || (Period == targetPeriod && SecondsLeftInPeriod > targetSecondsLeft))
            {
                // Advance in ~1-minute steps, occasionally scoring.
                SecondsLeftInPeriod -= 60;
                if (SecondsLeftInPeriod <= 0)
                {
                    if (Period >= 4) { SecondsLeftInPeriod = 0; break; }
                    Period++;
                    SecondsLeftInPeriod = QuarterSeconds;
                }

                if (Random.Shared.NextDouble() < 0.18)
                {
                    var points = Random.Shared.NextDouble() < 0.6 ? 7 : 3;
                    if (Random.Shared.Next(2) == 0) HomeScore += points; else AwayScore += points;
                }
                changed = true;
            }

            if (targetElapsedGameSeconds >= 4 * QuarterSeconds && Status != GameStatus.Final)
            {
                Status = GameStatus.Final;
                SecondsLeftInPeriod = 0;
                Period = 4;
                changed = true;
            }

            return changed;
        }

        public ScoreSnapshot Snapshot() => new(
            HomeScore,
            AwayScore,
            Period,
            Status == GameStatus.Final ? null : $"{SecondsLeftInPeriod / 60:00}:{SecondsLeftInPeriod % 60:00}",
            EstimateHomeWinProbability());

        public FeedGame ToFeedGame() => new(
            ExternalId,
            KickoffUtc,
            Home,
            Away,
            Status,
            Venue: null,
            Broadcasts: League == League.Nfl ? ["CBS"] : ["ESPN"],
            Score: Status == GameStatus.Scheduled ? null : Snapshot());

        private double EstimateHomeWinProbability()
        {
            var diff = HomeScore - AwayScore;
            var minutesLeft = ((4 - Period) * 15) + SecondsLeftInPeriod / 60.0;
            var weight = 1.0 + (60.0 - minutesLeft) / 15.0; // late leads matter more
            var p = 1.0 / (1.0 + Math.Exp(-0.16 * diff * weight));
            return Math.Round(Status == GameStatus.Final ? (diff > 0 ? 1 : diff < 0 ? 0 : 0.5) : p, 3);
        }
    }

    private static string Nfl(string abbr) => $"https://a.espncdn.com/i/teamlogos/nfl/500/{abbr}.png";
    private static string Ncaa(int espnId) => $"https://a.espncdn.com/i/teamlogos/ncaa/500/{espnId}.png";

    // Small built-in rosters (external ids are stable sim keys, not real ids).
    // LogoUrl points at ESPN's public CDN.
    private static readonly FeedTeam[] NflTeams =
    [
        new("sim-nfl-kc", "Kansas City", "Chiefs", "Kansas City Chiefs", "KC", "AFC", "AFC West", Nfl("kc")),
        new("sim-nfl-buf", "Buffalo", "Bills", "Buffalo Bills", "BUF", "AFC", "AFC East", Nfl("buf")),
        new("sim-nfl-phi", "Philadelphia", "Eagles", "Philadelphia Eagles", "PHI", "NFC", "NFC East", Nfl("phi")),
        new("sim-nfl-sf", "San Francisco", "49ers", "San Francisco 49ers", "SF", "NFC", "NFC West", Nfl("sf")),
        new("sim-nfl-dal", "Dallas", "Cowboys", "Dallas Cowboys", "DAL", "NFC", "NFC East", Nfl("dal")),
        new("sim-nfl-bal", "Baltimore", "Ravens", "Baltimore Ravens", "BAL", "AFC", "AFC North", Nfl("bal")),
        new("sim-nfl-det", "Detroit", "Lions", "Detroit Lions", "DET", "NFC", "NFC North", Nfl("det")),
        new("sim-nfl-mia", "Miami", "Dolphins", "Miami Dolphins", "MIA", "AFC", "AFC East", Nfl("mia")),
    ];

    private static readonly FeedTeam[] NcaaTeams =
    [
        new("sim-ncaa-uga", "Georgia", "Bulldogs", "Georgia Bulldogs", "UGA", "SEC", "Eastern Division", Ncaa(61)),
        new("sim-ncaa-ala", "Alabama", "Crimson Tide", "Alabama Crimson Tide", "ALA", "SEC", "Eastern Division", Ncaa(333)),
        new("sim-ncaa-osu", "Ohio State", "Buckeyes", "Ohio State Buckeyes", "OSU", "Big Ten", "East Division", Ncaa(194)),
        new("sim-ncaa-mich", "Michigan", "Wolverines", "Michigan Wolverines", "MICH", "Big Ten", "East Division", Ncaa(130)),
        new("sim-ncaa-tex", "Texas", "Longhorns", "Texas Longhorns", "TEX", "SEC", "Western Division", Ncaa(251)),
        new("sim-ncaa-ore", "Oregon", "Ducks", "Oregon Ducks", "ORE", "Big Ten", "West Division", Ncaa(2483)),
        new("sim-ncaa-fsu", "Florida State", "Seminoles", "Florida State Seminoles", "FSU", "ACC", "Atlantic Division", Ncaa(52)),
        new("sim-ncaa-clem", "Clemson", "Tigers", "Clemson Tigers", "CLEM", "ACC", "Atlantic Division", Ncaa(228)),
    ];
}
