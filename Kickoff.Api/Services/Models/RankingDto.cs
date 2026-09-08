namespace Kickoff.Api.Services.Models;

public record RankingPollDto(
    string Source,
    string Name,
    string Label,
    int SeasonYear,
    int RequestedWeek,
    int PollWeek,
    bool IsExactWeek,
    DateTimeOffset? PublishedAt,
    IReadOnlyList<RankedTeamDto> Rankings);

public record RankedTeamDto(
    int TeamId,
    string DisplayName,
    string Abbreviation,
    string? LogoUrl,
    int Rank,
    int? PreviousRank);
