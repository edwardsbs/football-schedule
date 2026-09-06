using System.Text.Json.Serialization;
using Kickoff.Api.Domain;
using Kickoff.Api.Integrations.SportsData;
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
builder.Services.AddScoped<StandingsService>();

// --- sports data sync ---
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.Configure<SportsDataOptions>(
    builder.Configuration.GetSection(SportsDataOptions.SectionName));
builder.Services.AddScoped<ScheduleImportService>();
builder.Services.AddScoped<ScoreSyncService>();

var sportsDataOptions = builder.Configuration
    .GetSection(SportsDataOptions.SectionName).Get<SportsDataOptions>() ?? new SportsDataOptions();

if (sportsDataOptions.Provider == SportsDataProvider.Espn)
{
    // ESPN's edge blocks requests with no User-Agent header at all (verified: a
    // bare HttpClient request 403s, curl's default UA passes) — HttpClient sends
    // none by default, so one must be set explicitly. Any non-empty value works;
    // this one just self-identifies honestly rather than spoofing a browser.
    builder.Services.AddHttpClient<ISportsDataClient, EspnHttpClient>(c =>
        c.DefaultRequestHeaders.UserAgent.ParseAdd("Kickoff/1.0 (+https://github.com/edwardsbs/football-schedule)"));
}
else
{
    builder.Services.AddSingleton<ISportsDataClient, SimulatedSportsDataClient>();
}

builder.Services.AddHostedService<LiveScoreSyncWorker>();
builder.Services.AddHostedService<ScheduleSyncWorker>();

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
