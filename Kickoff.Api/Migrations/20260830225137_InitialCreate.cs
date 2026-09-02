using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kickoff.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "kickoff");

            migrationBuilder.CreateTable(
                name: "Conferences",
                schema: "kickoff",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    League = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    ShortName = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Conferences", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Seasons",
                schema: "kickoff",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    League = table.Column<int>(type: "int", nullable: false),
                    Year = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Seasons", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                schema: "kickoff",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Venues",
                schema: "kickoff",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    City = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    State = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsIndoor = table.Column<bool>(type: "bit", nullable: false),
                    Latitude = table.Column<double>(type: "float", nullable: true),
                    Longitude = table.Column<double>(type: "float", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Venues", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Teams",
                schema: "kickoff",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    League = table.Column<int>(type: "int", nullable: false),
                    ConferenceId = table.Column<int>(type: "int", nullable: true),
                    Location = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Abbreviation = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    PrimaryColor = table.Column<string>(type: "nvarchar(9)", maxLength: 9, nullable: true),
                    LogoUrl = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ExternalId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Teams", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Teams_Conferences_ConferenceId",
                        column: x => x.ConferenceId,
                        principalSchema: "kickoff",
                        principalTable: "Conferences",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "Weeks",
                schema: "kickoff",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SeasonId = table.Column<int>(type: "int", nullable: false),
                    Number = table.Column<int>(type: "int", nullable: false),
                    Label = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Weeks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Weeks_Seasons_SeasonId",
                        column: x => x.SeasonId,
                        principalSchema: "kickoff",
                        principalTable: "Seasons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserFavoriteTeams",
                schema: "kickoff",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "int", nullable: false),
                    TeamId = table.Column<int>(type: "int", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserFavoriteTeams", x => new { x.UserId, x.TeamId });
                    table.ForeignKey(
                        name: "FK_UserFavoriteTeams_Teams_TeamId",
                        column: x => x.TeamId,
                        principalSchema: "kickoff",
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserFavoriteTeams_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "kickoff",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Games",
                schema: "kickoff",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    WeekId = table.Column<int>(type: "int", nullable: false),
                    League = table.Column<int>(type: "int", nullable: false),
                    HomeTeamId = table.Column<int>(type: "int", nullable: false),
                    AwayTeamId = table.Column<int>(type: "int", nullable: false),
                    VenueId = table.Column<int>(type: "int", nullable: true),
                    KickoffUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    HomeScore = table.Column<int>(type: "int", nullable: true),
                    AwayScore = table.Column<int>(type: "int", nullable: true),
                    Period = table.Column<int>(type: "int", nullable: true),
                    Clock = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    PossessionTeamId = table.Column<int>(type: "int", nullable: true),
                    HomeWinProbability = table.Column<double>(type: "float", nullable: true),
                    ExternalId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    LastUpdatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Games", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Games_Teams_AwayTeamId",
                        column: x => x.AwayTeamId,
                        principalSchema: "kickoff",
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Games_Teams_HomeTeamId",
                        column: x => x.HomeTeamId,
                        principalSchema: "kickoff",
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Games_Teams_PossessionTeamId",
                        column: x => x.PossessionTeamId,
                        principalSchema: "kickoff",
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Games_Venues_VenueId",
                        column: x => x.VenueId,
                        principalSchema: "kickoff",
                        principalTable: "Venues",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Games_Weeks_WeekId",
                        column: x => x.WeekId,
                        principalSchema: "kickoff",
                        principalTable: "Weeks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Broadcasts",
                schema: "kickoff",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    GameId = table.Column<int>(type: "int", nullable: false),
                    Network = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    IsStreaming = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Broadcasts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Broadcasts_Games_GameId",
                        column: x => x.GameId,
                        principalSchema: "kickoff",
                        principalTable: "Games",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CircledGames",
                schema: "kickoff",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "int", nullable: false),
                    GameId = table.Column<int>(type: "int", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(280)", maxLength: 280, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CircledGames", x => new { x.UserId, x.GameId });
                    table.ForeignKey(
                        name: "FK_CircledGames_Games_GameId",
                        column: x => x.GameId,
                        principalSchema: "kickoff",
                        principalTable: "Games",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CircledGames_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "kickoff",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "GameMutes",
                schema: "kickoff",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "int", nullable: false),
                    GameId = table.Column<int>(type: "int", nullable: false),
                    MuteType = table.Column<int>(type: "int", nullable: false),
                    IsWatched = table.Column<bool>(type: "bit", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    WatchedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GameMutes", x => new { x.UserId, x.GameId });
                    table.ForeignKey(
                        name: "FK_GameMutes_Games_GameId",
                        column: x => x.GameId,
                        principalSchema: "kickoff",
                        principalTable: "Games",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GameMutes_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "kickoff",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Broadcasts_GameId_Network",
                schema: "kickoff",
                table: "Broadcasts",
                columns: new[] { "GameId", "Network" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CircledGames_GameId",
                schema: "kickoff",
                table: "CircledGames",
                column: "GameId");

            migrationBuilder.CreateIndex(
                name: "IX_Conferences_League_Name",
                schema: "kickoff",
                table: "Conferences",
                columns: new[] { "League", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GameMutes_GameId",
                schema: "kickoff",
                table: "GameMutes",
                column: "GameId");

            migrationBuilder.CreateIndex(
                name: "IX_Games_AwayTeamId",
                schema: "kickoff",
                table: "Games",
                column: "AwayTeamId");

            migrationBuilder.CreateIndex(
                name: "IX_Games_ExternalId",
                schema: "kickoff",
                table: "Games",
                column: "ExternalId",
                unique: true,
                filter: "[ExternalId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Games_HomeTeamId",
                schema: "kickoff",
                table: "Games",
                column: "HomeTeamId");

            migrationBuilder.CreateIndex(
                name: "IX_Games_KickoffUtc_League",
                schema: "kickoff",
                table: "Games",
                columns: new[] { "KickoffUtc", "League" });

            migrationBuilder.CreateIndex(
                name: "IX_Games_PossessionTeamId",
                schema: "kickoff",
                table: "Games",
                column: "PossessionTeamId");

            migrationBuilder.CreateIndex(
                name: "IX_Games_Status",
                schema: "kickoff",
                table: "Games",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Games_VenueId",
                schema: "kickoff",
                table: "Games",
                column: "VenueId");

            migrationBuilder.CreateIndex(
                name: "IX_Games_WeekId",
                schema: "kickoff",
                table: "Games",
                column: "WeekId");

            migrationBuilder.CreateIndex(
                name: "IX_Seasons_League_Year",
                schema: "kickoff",
                table: "Seasons",
                columns: new[] { "League", "Year" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Teams_ConferenceId",
                schema: "kickoff",
                table: "Teams",
                column: "ConferenceId");

            migrationBuilder.CreateIndex(
                name: "IX_Teams_ExternalId",
                schema: "kickoff",
                table: "Teams",
                column: "ExternalId",
                unique: true,
                filter: "[ExternalId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_UserFavoriteTeams_TeamId",
                schema: "kickoff",
                table: "UserFavoriteTeams",
                column: "TeamId");

            migrationBuilder.CreateIndex(
                name: "IX_Weeks_SeasonId_Number",
                schema: "kickoff",
                table: "Weeks",
                columns: new[] { "SeasonId", "Number" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Broadcasts",
                schema: "kickoff");

            migrationBuilder.DropTable(
                name: "CircledGames",
                schema: "kickoff");

            migrationBuilder.DropTable(
                name: "GameMutes",
                schema: "kickoff");

            migrationBuilder.DropTable(
                name: "UserFavoriteTeams",
                schema: "kickoff");

            migrationBuilder.DropTable(
                name: "Games",
                schema: "kickoff");

            migrationBuilder.DropTable(
                name: "Users",
                schema: "kickoff");

            migrationBuilder.DropTable(
                name: "Teams",
                schema: "kickoff");

            migrationBuilder.DropTable(
                name: "Venues",
                schema: "kickoff");

            migrationBuilder.DropTable(
                name: "Weeks",
                schema: "kickoff");

            migrationBuilder.DropTable(
                name: "Conferences",
                schema: "kickoff");

            migrationBuilder.DropTable(
                name: "Seasons",
                schema: "kickoff");
        }
    }
}
