using Kickoff.Api.Domain;

namespace Kickoff.Api.Services;

/// <summary>
/// Write-side for spoiler protection: toggle a game's mute for a user and
/// unlock a "watch later" game once it has been watched.
/// </summary>
public class MuteService(IKickoffContext db)
{
    /// <summary>Mute a game, or change an existing mute's type. Idempotent.</summary>
    public async Task MuteAsync(int gameId, int userId, MuteType type, CancellationToken ct = default)
    {
        var mute = await db.GameMutes.FindAsync([userId, gameId], ct);
        if (mute is null)
        {
            db.GameMutes.Add(new GameMute
            {
                UserId = userId,
                GameId = gameId,
                MuteType = type,
                IsWatched = false,
                CreatedUtc = DateTimeOffset.UtcNow,
            });
        }
        else
        {
            mute.MuteType = type;
            if (type == MuteType.WatchLater)
            {
                // Re-arm the watch queue.
                mute.IsWatched = false;
                mute.WatchedUtc = null;
            }
        }

        await db.SaveChangesAsync(ct);
    }

    /// <summary>Remove a game's mute entirely (reveal it everywhere).</summary>
    public async Task UnmuteAsync(int gameId, int userId, CancellationToken ct = default)
    {
        var mute = await db.GameMutes.FindAsync([userId, gameId], ct);
        if (mute is null) return;

        db.GameMutes.Remove(mute);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Mark a "watch later" game as watched, which unlocks its score. A no-op
    /// if the game is not muted; a plain mute stays muted (clear it with unmute).
    /// </summary>
    public async Task MarkWatchedAsync(int gameId, int userId, CancellationToken ct = default)
    {
        var mute = await db.GameMutes.FindAsync([userId, gameId], ct);
        if (mute is null) return;

        mute.IsWatched = true;
        mute.WatchedUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
    }
}
