using Microsoft.AspNetCore.Mvc.Filters;

namespace Kickoff.Api.Services;

/// <summary>
/// Requires a matching X-Admin-Key header when Admin:SyncApiKey is configured.
/// Left unset in local dev (no check); prod sets it via the Admin__SyncApiKey
/// env var in docker-compose so the endpoint isn't open to the whole LAN.
/// </summary>
public class AdminApiKeyFilter(IConfiguration config) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var expected = config["Admin:SyncApiKey"];
        if (!string.IsNullOrEmpty(expected))
        {
            var provided = context.HttpContext.Request.Headers["X-Admin-Key"].ToString();
            if (!string.Equals(provided, expected, StringComparison.Ordinal))
            {
                context.Result = new Microsoft.AspNetCore.Mvc.UnauthorizedResult();
                return;
            }
        }

        await next();
    }
}
