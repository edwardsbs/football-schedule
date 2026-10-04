using Kickoff.Api.Domain;

namespace Kickoff.Api.Services.Models;

public record TeamScheduleDto(
    TeamSummaryDto Team,
    League League,
    int SeasonYear,
    IReadOnlyList<GameDto> Games);
