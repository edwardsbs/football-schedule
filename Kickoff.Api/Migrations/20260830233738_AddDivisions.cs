using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kickoff.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDivisions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DivisionId",
                schema: "kickoff",
                table: "Teams",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Divisions",
                schema: "kickoff",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ConferenceId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    ShortName = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Divisions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Divisions_Conferences_ConferenceId",
                        column: x => x.ConferenceId,
                        principalSchema: "kickoff",
                        principalTable: "Conferences",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Teams_DivisionId",
                schema: "kickoff",
                table: "Teams",
                column: "DivisionId");

            migrationBuilder.CreateIndex(
                name: "IX_Divisions_ConferenceId_Name",
                schema: "kickoff",
                table: "Divisions",
                columns: new[] { "ConferenceId", "Name" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Teams_Divisions_DivisionId",
                schema: "kickoff",
                table: "Teams",
                column: "DivisionId",
                principalSchema: "kickoff",
                principalTable: "Divisions",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Teams_Divisions_DivisionId",
                schema: "kickoff",
                table: "Teams");

            migrationBuilder.DropTable(
                name: "Divisions",
                schema: "kickoff");

            migrationBuilder.DropIndex(
                name: "IX_Teams_DivisionId",
                schema: "kickoff",
                table: "Teams");

            migrationBuilder.DropColumn(
                name: "DivisionId",
                schema: "kickoff",
                table: "Teams");
        }
    }
}
