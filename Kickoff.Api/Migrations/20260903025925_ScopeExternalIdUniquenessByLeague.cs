using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kickoff.Api.Migrations
{
    /// <inheritdoc />
    public partial class ScopeExternalIdUniquenessByLeague : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Teams_ExternalId",
                schema: "kickoff",
                table: "Teams");

            migrationBuilder.DropIndex(
                name: "IX_Games_ExternalId",
                schema: "kickoff",
                table: "Games");

            migrationBuilder.CreateIndex(
                name: "IX_Teams_League_ExternalId",
                schema: "kickoff",
                table: "Teams",
                columns: new[] { "League", "ExternalId" },
                unique: true,
                filter: "[ExternalId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Games_League_ExternalId",
                schema: "kickoff",
                table: "Games",
                columns: new[] { "League", "ExternalId" },
                unique: true,
                filter: "[ExternalId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Teams_League_ExternalId",
                schema: "kickoff",
                table: "Teams");

            migrationBuilder.DropIndex(
                name: "IX_Games_League_ExternalId",
                schema: "kickoff",
                table: "Games");

            migrationBuilder.CreateIndex(
                name: "IX_Teams_ExternalId",
                schema: "kickoff",
                table: "Teams",
                column: "ExternalId",
                unique: true,
                filter: "[ExternalId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Games_ExternalId",
                schema: "kickoff",
                table: "Games",
                column: "ExternalId",
                unique: true,
                filter: "[ExternalId] IS NOT NULL");
        }
    }
}
