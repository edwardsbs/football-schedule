using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kickoff.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUserTeamInterests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserTeamInterests",
                schema: "kickoff",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "int", nullable: false),
                    TeamId = table.Column<int>(type: "int", nullable: false),
                    CreatedUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserTeamInterests", x => new { x.UserId, x.TeamId });
                    table.ForeignKey(
                        name: "FK_UserTeamInterests_Teams_TeamId",
                        column: x => x.TeamId,
                        principalSchema: "kickoff",
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserTeamInterests_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "kickoff",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserTeamInterests_TeamId",
                schema: "kickoff",
                table: "UserTeamInterests",
                column: "TeamId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserTeamInterests",
                schema: "kickoff");
        }
    }
}
