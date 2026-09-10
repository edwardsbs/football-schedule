namespace Kickoff.Api.Integrations.SportsData.Contracts;

public record FeedFieldPosition(
    int? Down,
    int? Distance,
    int? YardLine,
    int? YardsToEndzone,
    string? DownDistanceText,
    string? PossessionText,
    string? TeamExternalId);

public record FeedPlay(
    string? Id,
    string? Text,
    string? Type,
    string? TeamExternalId,
    int? Period,
    string? Clock,
    bool IsScoringPlay,
    bool IsTurnover,
    bool IsPenalty,
    int? ScoreValue,
    int? HomeScore,
    int? AwayScore,
    int? StatYardage,
    FeedFieldPosition? Start,
    FeedFieldPosition? End);

public record FeedDrive(
    string? TeamExternalId,
    string? Description,
    string? Result,
    string? TimeElapsed,
    int? Plays,
    int? Yards,
    bool IsScore,
    FeedFieldPosition? Start,
    FeedFieldPosition? End);

public record FeedWinProbabilityPoint(
    int Sequence,
    string? PlayId,
    double HomeWinPercentage);

public record FeedStatistic(string Name, string Label, string DisplayValue);

public record FeedTeamStatistics(
    string TeamExternalId,
    string TeamAbbreviation,
    IReadOnlyList<FeedStatistic> Statistics);

public record FeedLeader(
    string Category,
    string CategoryLabel,
    string Athlete,
    string? Position,
    string DisplayValue,
    string? HeadshotUrl);

public record FeedTeamLeaders(
    string TeamExternalId,
    string TeamAbbreviation,
    IReadOnlyList<FeedLeader> Leaders);

public record FeedInjury(
    string Athlete,
    string? Position,
    string Status,
    string? Type,
    string? Detail,
    string? Side,
    DateTimeOffset? UpdatedUtc,
    string? ReturnDate,
    string? HeadshotUrl);

public record FeedTeamInjuries(
    string TeamExternalId,
    string TeamAbbreviation,
    IReadOnlyList<FeedInjury> Injuries);

public record FeedGameContext(
    string? Venue,
    string? City,
    string? State,
    bool? Grass,
    int? Attendance,
    string? VenueImageUrl);

public record FeedMarket(
    string? Provider,
    string? Details,
    double? Spread,
    double? OverUnder,
    int? HomeMoneyLine,
    int? AwayMoneyLine);

public record FeedStandingEntry(string TeamExternalId, string TeamName, string? Record);

public record FeedStandingsGroup(
    string Name,
    string? ShortName,
    IReadOnlyList<FeedStandingEntry> Entries);

public record FeedNewsItem(
    string Headline,
    string? Description,
    DateTimeOffset? PublishedUtc,
    string? Url,
    string? ImageUrl);

/// <summary>
/// Rich per-game data from the provider's summary surface. This is fetched on
/// demand and cached; it is intentionally separate from the lightweight
/// all-live-games scoreboard poll.
/// </summary>
public record FeedGameSummary(
    DateTimeOffset RetrievedUtc,
    FeedPlay? LastPlay,
    FeedDrive? CurrentDrive,
    IReadOnlyList<FeedPlay> ScoringPlays,
    double? HomeWinProbability,
    IReadOnlyList<FeedWinProbabilityPoint> WinProbability,
    IReadOnlyList<FeedTeamStatistics> TeamStatistics,
    IReadOnlyList<FeedTeamLeaders> Leaders,
    IReadOnlyList<FeedTeamInjuries> Injuries,
    FeedGameContext? Context,
    FeedMarket? Market,
    IReadOnlyList<FeedStandingsGroup> Standings,
    IReadOnlyList<FeedNewsItem> News);
