using Kickoff.Api.Domain;

namespace Kickoff.Api.Services.Sync;

/// <summary>
/// Parses a configured league-name list (e.g. <see cref="Integrations.SportsData.SportsDataOptions.LiveLeagues"/>)
/// into distinct <see cref="League"/> values, shared by the background sync workers.
/// </summary>
public static class LeagueListParser
{
    public static List<League> Parse(IEnumerable<string> names)
    {
        var leagues = new List<League>();
        foreach (var n in names)
        {
            if (Enum.TryParse<League>(n, ignoreCase: true, out var league) && !leagues.Contains(league))
                leagues.Add(league);
        }
        return leagues.Count > 0 ? leagues : [League.Nfl, League.Ncaa];
    }
}
