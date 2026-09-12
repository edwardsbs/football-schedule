namespace Kickoff.Api.Domain;

public enum League
{
    Ncaa,
    Nfl
}

public enum GameStatus
{
    Scheduled,
    InProgress,
    Halftime,
    Final,
    Postponed,
    Canceled,
    Delayed
}

/// <summary>
/// How a user has silenced a game for spoiler protection.
/// <see cref="Muted"/> is a plain, indefinite mute; <see cref="WatchLater"/>
/// stays muted until the user marks the game watched.
/// </summary>
public enum MuteType
{
    Muted,
    WatchLater
}
