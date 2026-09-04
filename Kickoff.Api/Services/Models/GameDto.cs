using Kickoff.Api.Domain;

namespace Kickoff.Api.Services.Models;

/// <summary>Spoiler-safe coarse status. Never reports Final/Halftime for a muted game.</summary>
public enum GameSafeStatus
{
    Upcoming,
    Live,
    Final,
    Postponed,
    Canceled,
}

public record TeamSummaryDto(
    int Id,
    string DisplayName,
    string Abbreviation,
    string? LogoUrl,
    string? PrimaryColor);

public record BroadcastDto(string Network, bool IsStreaming);

/// <summary>
/// The result-revealing block. It is <c>null</c> on the DTO whenever the game
/// is actively muted for the requesting user (and not being revealed) — so a
/// hidden score is structurally absent, not merely blanked.
/// </summary>
public record ScoreDto(
    int HomeScore,
    int AwayScore,
    int? Period,
    string? Clock,
    int? PossessionTeamId,
    string? DownDistance,
    double? HomeWinProbability);

/// <summary>
/// A game as sent to the client. <see cref="Score"/> is populated only when the
/// game has kicked off AND is not being hidden by the caller's mute state.
/// </summary>
public record GameDto(
    int Id,
    League League,
    TeamSummaryDto Home,
    TeamSummaryDto Away,
    DateTimeOffset KickoffUtc,
    string? Venue,
    IReadOnlyList<BroadcastDto> Broadcasts,
    GameSafeStatus Status,
    bool IsMuted,
    MuteType? MuteType,
    ScoreDto? Score,
    bool HasFavorite,
    bool IsCircled,
    int WeekNumber,
    string WeekLabel);
