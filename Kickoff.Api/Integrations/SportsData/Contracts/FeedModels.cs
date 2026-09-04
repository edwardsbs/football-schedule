using Kickoff.Api.Domain;

namespace Kickoff.Api.Integrations.SportsData.Contracts;

/// <summary>
/// League-agnostic, normalized shapes that every <see cref="ISportsDataClient"/>
/// returns. Raw provider JSON (which differs between the NFL and NCAAFB feeds
/// and between providers) is translated into these before it reaches the domain,
/// so the sync services never depend on the provider's wire format.
/// </summary>
public record FeedTeam(
    string ExternalId,
    string Location,
    string Name,
    string DisplayName,
    string Abbreviation,
    string? Conference = null,
    string? Division = null,
    string? LogoUrl = null);

public record ScoreSnapshot(
    int HomeScore,
    int AwayScore,
    int? Period,
    string? Clock,
    string? PossessionTeamExternalId,
    string? DownDistance,
    double? HomeWinProbability);

public record FeedGame(
    string ExternalId,
    DateTimeOffset KickoffUtc,
    FeedTeam Home,
    FeedTeam Away,
    GameStatus Status,
    string? Venue,
    IReadOnlyList<string> Broadcasts,
    ScoreSnapshot? Score);

public record ScheduleFeed(
    League League,
    int SeasonYear,
    int Week,
    IReadOnlyList<FeedGame> Games);

/// <summary>A single game's live line, returned by the live-score poll.</summary>
public record GameScoreUpdate(
    string GameExternalId,
    GameStatus Status,
    ScoreSnapshot Score);
