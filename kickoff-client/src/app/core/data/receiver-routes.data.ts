export interface ReceiverRoute {
  number: number;
  name: string;
  aliases?: string;
  depth: string;
  summary: string;
  coachingPoint: string;
  pathData: string;
}

/** Classic 1–9 receiver route tree plus common advanced routes. Terminology can vary by playbook. */
export const RECEIVER_ROUTES: ReceiverRoute[] = [
  {
    number: 1,
    name: 'Flat',
    depth: '1–5 yards',
    summary: 'Release quickly toward the sideline and give the quarterback an immediate outlet.',
    coachingPoint: 'Stay flat after the break so you do not drift into deeper coverage.',
    pathData: 'M220 310 L220 282 Q220 260 195 252 L72 252',
  },
  {
    number: 2,
    name: 'Slant',
    depth: '3–6 yards',
    summary: 'Attack inside leverage with a sharp diagonal break into the middle of the field.',
    coachingPoint: 'Sell the vertical release, plant outside, and cross the defender’s face.',
    pathData: 'M220 310 L220 270 Q220 252 238 242 L350 178',
  },
  {
    number: 3,
    name: 'Comeback',
    depth: '12–15 yards',
    summary: 'Threaten deep, then break down and return toward the sideline and quarterback.',
    coachingPoint: 'Drive vertically first; the route only works when the defender fears the go ball.',
    pathData: 'M220 310 L220 132 Q220 116 204 128 L126 190',
  },
  {
    number: 4,
    name: 'Hook',
    aliases: 'Curl',
    depth: '8–12 yards',
    summary: 'Stem vertically, stop in open space, and turn back toward the quarterback.',
    coachingPoint: 'Come back downhill to the ball instead of waiting flat-footed.',
    pathData: 'M220 310 L220 152 Q220 134 204 146 L180 180',
  },
  {
    number: 5,
    name: 'Out',
    depth: '8–12 yards',
    summary: 'Push vertically, then make a hard 90-degree break toward the sideline.',
    coachingPoint: 'Drop your hips at the top and keep the break square and flat.',
    pathData: 'M220 310 L220 158 Q220 142 204 142 L70 142',
  },
  {
    number: 6,
    name: 'In',
    aliases: 'Dig',
    depth: '10–15 yards',
    summary: 'Push vertically, then cross the field on a firm 90-degree inside break.',
    coachingPoint: 'Do not round the cut; flatten across the field after the break.',
    pathData: 'M220 310 L220 142 Q220 126 238 126 L370 126',
  },
  {
    number: 7,
    name: 'Corner',
    aliases: 'Flag',
    depth: '12–18 yards',
    summary: 'Stem vertically and break diagonally toward the back corner of the field.',
    coachingPoint: 'Aim high enough to clear underneath coverage without drifting out of bounds.',
    pathData: 'M220 310 L220 160 Q220 142 204 126 L96 42',
  },
  {
    number: 8,
    name: 'Post',
    depth: '12–18 yards',
    summary: 'Stem vertically and break diagonally toward the goalpost and middle of the field.',
    coachingPoint: 'Lean outside before the break to create room across the defender’s face.',
    pathData: 'M220 310 L220 158 Q220 140 238 124 L336 42',
  },
  {
    number: 9,
    name: 'Fade',
    aliases: 'Go · Fly · Streak',
    depth: 'Deep',
    summary: 'Release vertically and stretch the defense all the way downfield.',
    coachingPoint: 'Stack the defender, stay on your line, and leave room for the throw outside.',
    pathData: 'M220 310 C208 250 216 150 220 36',
  },
  {
    number: 10,
    name: 'Wheel',
    depth: 'Deep',
    summary: 'Release toward the flat, turn up the sideline, and accelerate into vertical space.',
    coachingPoint: 'Sell the flat route first, then hug the sideline as you transition upfield.',
    pathData: 'M220 310 L220 284 Q220 260 194 252 L134 252 Q92 252 84 210 L68 42',
  },
  {
    number: 11,
    name: 'Sluggo',
    aliases: 'Slant-and-go',
    depth: 'Deep',
    summary: 'Sell the slant inside, plant, and redirect vertically past a defender who jumps the break.',
    coachingPoint: 'Make the first three steps look exactly like your slant before snapping back upfield.',
    pathData: 'M220 310 L220 274 Q220 256 238 246 L278 224 Q294 215 296 192 L300 42',
  },
];
