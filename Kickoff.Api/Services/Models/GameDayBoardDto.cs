namespace Kickoff.Api.Services.Models;

public record GameDayBoardDto(
    IReadOnlyList<int> WatchedGameIds,
    IReadOnlyList<int> AutoExcludedGameIds);
