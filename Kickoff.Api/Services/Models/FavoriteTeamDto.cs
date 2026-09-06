using Kickoff.Api.Domain;

namespace Kickoff.Api.Services.Models;

/// <summary>A favorited team, for the "My Teams" strip.</summary>
public record FavoriteTeamDto(
    int TeamId,
    League League,
    string DisplayName,
    string Abbreviation,
    string? LogoUrl,
    int? CurrentRank);
