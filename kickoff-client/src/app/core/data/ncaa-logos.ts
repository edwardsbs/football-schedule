/**
 * Team name → ESPN team id, for building college logo URLs
 * (https://a.espncdn.com/i/teamlogos/ncaa/500/{id}.png). Keys must match the
 * names used in ncaa-alignment.data.ts exactly. A missing/incorrect id simply
 * yields no URL (or a 404), and TeamBadge falls back to a monogram.
 */
export const NCAA_ESPN_IDS: Record<string, number> = {
  // SEC
  Alabama: 333, Florida: 57, Georgia: 61, Kentucky: 96, 'Mississippi State': 344,
  Missouri: 142, 'South Carolina': 2579, Tennessee: 2633, Arkansas: 8, Auburn: 2,
  LSU: 99, Oklahoma: 201, 'Ole Miss': 145, 'Texas A&M': 245, Vanderbilt: 238, Texas: 251,
  // Big Ten
  Illinois: 356, Indiana: 84, Michigan: 130, 'Michigan State': 127, 'Ohio State': 194,
  'Penn State': 213, Rutgers: 164, Wisconsin: 275, Iowa: 2294, Maryland: 120,
  Minnesota: 135, Nebraska: 158, Northwestern: 77, Oregon: 2483, Purdue: 2509,
  UCLA: 26, USC: 30, Washington: 264,
  // Big 12
  Arizona: 12, 'Arizona State': 9, BYU: 252, Colorado: 38, Kansas: 2305,
  'Kansas State': 2306, Utah: 254, Baylor: 239, Cincinnati: 2132, Houston: 248,
  'Iowa State': 66, 'Oklahoma State': 197, TCU: 2628, 'Texas Tech': 2641, 'West Virginia': 277,
  // ACC
  'Boston College': 103, Clemson: 228, 'Florida State': 52, Louisville: 97, 'NC State': 152,
  Syracuse: 183, 'Wake Forest': 154, Cal: 25, Duke: 150, 'Georgia Tech': 59, Miami: 2390,
  'North Carolina': 153, Pittsburgh: 221, Virginia: 258, 'Virginia Tech': 259, SMU: 2567,
  // Pac-12 (additional)
  'Boise State': 68, 'Oregon State': 204, 'Washington State': 265, Stanford: 24,
  'Colorado State': 36, 'San Diego State': 21,
  // American
  Charlotte: 2429, 'East Carolina': 151, 'Florida Atlantic': 2226, Memphis: 235, Navy: 2426,
  Rice: 242, Temple: 218, Tulane: 2655, 'North Texas': 249, 'South Florida': 58, Tulsa: 202,
  UTSA: 2636, UAB: 5, UConn: 41,
  // Mountain West
  'Air Force': 2005, Hawaii: 62, 'New Mexico': 167, 'Utah State': 328, Wyoming: 2751,
  Idaho: 70, Nevada: 2440, 'New Mexico State': 166, UNLV: 2439, 'North Dakota State': 2449,
  // Sun Belt
  'Appalachian State': 2026, 'Coastal Carolina': 324, 'Georgia Southern': 290,
  'James Madison': 256, Marshall: 276, 'Old Dominion': 295, 'Southern Miss': 2572,
  Louisiana: 309, 'Louisiana Tech': 2348, 'South Alabama': 6, Troy: 2653,
  'Texas State': 326, 'UL Monroe': 2433,
  // MAC
  Akron: 2006, 'Ball State': 2050, 'Bowling Green': 189, Buffalo: 2084,
  'Central Michigan': 2117, 'Eastern Michigan': 2199, 'Kent State': 2309, 'Miami (OH)': 193,
  'Northern Illinois': 2459, Ohio: 195, Toledo: 2649, 'Western Michigan': 2711,
  // Conference USA
  Delaware: 48, FIU: 2229, 'Kennesaw State': 338, Liberty: 2335, 'Middle Tennessee': 2393,
  'Sam Houston': 2534, UTEP: 2638, 'Western Kentucky': 98,
  // Independents
  'Notre Dame': 87,
};

export const ncaaLogoUrl = (name: string): string | undefined => {
  const id = NCAA_ESPN_IDS[name];
  return id === undefined ? undefined : `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png`;
};
