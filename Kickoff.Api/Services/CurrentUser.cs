namespace Kickoff.Api.Services;

public interface ICurrentUser
{
    int Id { get; }
}

/// <summary>Holds the seeded dev user's id (see startup seeding in Program).</summary>
public class DevUserState
{
    public int Id { get; set; } = 1;
}

/// <summary>
/// Dev stand-in for real auth: reads the user id from the <c>X-User-Id</c>
/// header, falling back to the seeded dev user. Replace with the authenticated
/// principal once sign-in exists — the rest of the app only depends on
/// <see cref="ICurrentUser"/>.
/// </summary>
public class HeaderCurrentUser(IHttpContextAccessor accessor, DevUserState dev) : ICurrentUser
{
    public int Id =>
        int.TryParse(accessor.HttpContext?.Request.Headers["X-User-Id"], out var id) ? id : dev.Id;
}
