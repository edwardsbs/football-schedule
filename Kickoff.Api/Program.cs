using System.Text.Json.Serialization;
using Kickoff.Api.Domain;
using Kickoff.Api.Integrations.SportsRadar;
using Kickoff.Api.Services;
using Kickoff.Api.Services.Sync;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Connection string from the "kickoff" config key / user-secrets.
var connectionString =
    builder.Configuration.GetConnectionString("kickoff")
    ?? builder.Configuration["kickoff"];

builder.Services.AddDbContext<KickoffContext>(options =>
    options.UseSqlServer(connectionString));
builder.Services.AddScoped<IKickoffContext>(sp => sp.GetRequiredService<KickoffContext>());

// Application services.
builder.Services.AddHttpContextAccessor();
builder.Services.AddSingleton<DevUserState>();
builder.Services.AddScoped<ICurrentUser, HeaderCurrentUser>();
builder.Services.AddScoped<GameQueryService>();
builder.Services.AddScoped<MuteService>();
builder.Services.AddScoped<FavoritesService>();
builder.Services.AddScoped<CircledService>();

// --- SportsRadar sync ---
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.Configure<SportsRadarOptions>(
    builder.Configuration.GetSection(SportsRadarOptions.SectionName));
builder.Services.AddScoped<ScheduleImportService>();
builder.Services.AddScoped<ScoreSyncService>();

var srOptions = builder.Configuration
    .GetSection(SportsRadarOptions.SectionName).Get<SportsRadarOptions>() ?? new SportsRadarOptions();

// Fall back to the simulator whenever the real provider isn't fully configured,
// so the app always has live data to show.
var useReal = srOptions.Provider == SportsRadarProvider.SportsRadar
              && !string.IsNullOrWhiteSpace(srOptions.ApiKey);
if (useReal)
{
    builder.Services.AddHttpClient<ISportsRadarClient, SportsRadarHttpClient>();
}
else
{
    builder.Services.AddSingleton<ISportsRadarClient, SimulatedSportsRadarClient>();
}

builder.Services.AddHostedService<LiveScoreSyncWorker>();

builder.Services
    .AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

var app = builder.Build();

// Dev only: make sure a user row exists so mutes (FK to Users) can be saved,
// and point the header-stub accessor at it. Remove once real auth exists.
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<KickoffContext>();
    var devUser = await db.Users.OrderBy(u => u.Id).FirstOrDefaultAsync();
    if (devUser is null)
    {
        devUser = new User { Name = "Dev" };
        db.Users.Add(devUser);
        await db.SaveChangesAsync();
    }
    app.Services.GetRequiredService<DevUserState>().Id = devUser.Id;
}

app.MapControllers();
app.MapGet("/api/health", () => Results.Ok(new { ok = true, at = DateTimeOffset.UtcNow }));

app.Run();
