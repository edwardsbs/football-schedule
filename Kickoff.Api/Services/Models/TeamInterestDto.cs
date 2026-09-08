using Kickoff.Api.Domain;

namespace Kickoff.Api.Services.Models;

/// <summary>A persistently monitored team that is independent of favorites.</summary>
public record TeamInterestDto(
    int TeamId,
    League League,
    string DisplayName,
    string Abbreviation,
    string? LogoUrl,
    int? CurrentRank);
