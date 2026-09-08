namespace Kickoff.Api.Domain;

/// <summary>
/// A single matchup, carrying both the static schedule data and the live
/// scoreboard. Live fields are null until kickoff and are the only fields the
/// scoring updater touches. The spoiler-protection layer strips the scoreboard
/// block from projections for games the requesting user has muted.
/// </summary>
public class Game
{
    public int Id { get; set; }

    public int WeekId { get; set; }
    public Week Week { get; set; } = null!;

    /// <summary>
    /// Denormalized from <see cref="Week"/> → <see cref="Season"/> so the merged
    /// timeline and live dashboard can filter by league without a two-level join.
    /// </summary>
    public League League { get; set; }

    public int HomeTeamId { get; set; }
    public Team HomeTeam { get; set; } = null!;
    public int AwayTeamId { get; set; }
    public Team AwayTeam { get; set; } = null!;

    public int? VenueId { get; set; }
    public Venue? Venue { get; set; }

    public DateTimeOffset KickoffUtc { get; set; }
    public GameStatus Status { get; set; }

    // --- live scoreboard (null until the game is in progress) ---
    public int? HomeScore { get; set; }
    public int? AwayScore { get; set; }
    public int? Period { get; set; }            // quarter
    public string? Clock { get; set; }          // "12:04"
    public int? PossessionTeamId { get; set; }
    public string? DownDistance { get; set; }   // "1st & 10 at MASS 45"
    public double? HomeWinProbability { get; set; }

    /// <summary>Sports-data provider identifier; upsert key when syncing scores.</summary>
    public string? ExternalId { get; set; }

    /// <summary>
    /// When the persisted status, score, clock, or live situation last changed.
    /// Identical provider polls do not advance this timestamp, allowing frozen
    /// live games to be detected and reconciled.
    /// </summary>
    public DateTimeOffset? LastUpdatedUtc { get; set; }

    public ICollection<Broadcast> Broadcasts { get; set; } = [];
}
