using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kickoff.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTeamIsFcs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsFcs",
                schema: "kickoff",
                table: "Teams",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsFcs",
                schema: "kickoff",
                table: "Teams");
        }
    }
}
