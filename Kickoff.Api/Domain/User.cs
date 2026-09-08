namespace Kickoff.Api.Domain;

public class User
{
    public int Id { get; set; }
    public string Name { get; set; } = "";

    public ICollection<UserFavoriteTeam> FavoriteTeams { get; set; } = [];
    public ICollection<UserTeamInterest> TeamsOfInterest { get; set; } = [];
    public ICollection<CircledGame> CircledGames { get; set; } = [];
    public ICollection<GameMute> Mutes { get; set; } = [];
}
