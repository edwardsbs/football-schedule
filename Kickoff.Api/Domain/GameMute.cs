namespace Kickoff.Api.Domain;

/// <summary>
/// A user's spoiler-protection state for one game (the spec's "MuteState").
/// A row exists only while the game is silenced for that user. Keyed on
/// (UserId, GameId), so there is at most one mute per user per game.
/// A game is considered actively muted when
/// <c>MuteType == Muted</c> or <c>(MuteType == WatchLater &amp;&amp; !IsWatched)</c>.
/// </summary>
public class GameMute
{
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public int GameId { get; set; }
    public Game Game { get; set; } = null!;

    public MuteType MuteType { get; set; }

    /// <summary>For <see cref="MuteType.WatchLater"/>: set true to unlock the score.</summary>
    public bool IsWatched { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }
    public DateTimeOffset? WatchedUtc { get; set; }
}
