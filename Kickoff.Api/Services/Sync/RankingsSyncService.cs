using Kickoff.Api.Domain;
using Kickoff.Api.Integrations.SportsData.Contracts;
using Microsoft.EntityFrameworkCore;

namespace Kickoff.Api.Services.Sync;

/// <summary>Replaces a league's stored ranks with one authoritative current poll.</summary>
public class RankingsSyncService(IKickoffContext db)
{
    public async Task<int> ApplyAsync(
        League league,
        IReadOnlyList<TeamRanking> rankings,
        CancellationToken ct = default)
    {
        // An empty provider result may mean a transient failure or no published
        // poll yet. Preserve the last good poll instead of clearing it blindly.
        if (rankings.Count == 0) return 0;

        var teams = await db.Teams
            .Where(team => team.League == league)
            .ToListAsync(ct);
        var byExternalId = teams
            .Where(team => team.ExternalId is not null)
            .ToDictionary(team => team.ExternalId!);

        foreach (var team in teams) team.CurrentRank = null;

        var applied = 0;
        foreach (var ranking in rankings)
        {
            if (!byExternalId.TryGetValue(ranking.TeamExternalId, out var team)) continue;
            team.CurrentRank = ranking.Rank;
            applied++;
        }

        await db.SaveChangesAsync(ct);
        return applied;
    }
}
