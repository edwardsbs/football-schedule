namespace Kickoff.Api.Domain;

public class Venue
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? City { get; set; }
    public string? State { get; set; }

    /// <summary>Seeds the Phase-2 weather badge (skip badge for indoor venues).</summary>
    public bool IsIndoor { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
}
