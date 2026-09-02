export type PositionGroup = 'ol' | 'backfield' | 'receiver' | 'dl' | 'lb' | 'db';

export interface FormationSpot {
  label: string;
  group: PositionGroup;
  x: number;
  y: number;
}

export interface ShellZone {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CoverageShell {
  name: string;
  family: string;
  detail: string;
  zones: ShellZone[];
}

export interface Formation {
  name: string;
  personnel: string;
  personnelCode?: string;
  blurb: string;
  shell?: CoverageShell;
  spots: FormationSpot[];
}

const OL: FormationSpot[] = [
  { label: 'LT', group: 'ol', x: 32, y: 50 },
  { label: 'LG', group: 'ol', x: 41, y: 50 },
  { label: 'C', group: 'ol', x: 50, y: 50 },
  { label: 'RG', group: 'ol', x: 59, y: 50 },
  { label: 'RT', group: 'ol', x: 68, y: 50 },
];

const shell = (name: string, family: string, detail: string, zones: ShellZone[]): CoverageShell => ({
  name,
  family,
  detail,
  zones,
});

const zone = (label: string, x: number, width: number, y = 7, height = 24): ShellZone => ({
  label,
  x,
  y,
  width,
  height,
});

export const OFFENSE_FORMATIONS: Formation[] = [
  {
    name: 'I-Formation',
    personnelCode: '21',
    personnel: '2 RB · 1 TE · 2 WR',
    blurb: 'A downhill, under-center look with a fullback leading the tailback into the run fit.',
    spots: [
      ...OL,
      { label: 'WR', group: 'receiver', x: 8, y: 50 }, { label: 'TE', group: 'receiver', x: 76, y: 50 },
      { label: 'WR', group: 'receiver', x: 92, y: 50 }, { label: 'QB', group: 'backfield', x: 50, y: 59 },
      { label: 'FB', group: 'backfield', x: 50, y: 69 }, { label: 'RB', group: 'backfield', x: 50, y: 82 },
    ],
  },
  {
    name: 'Singleback Ace',
    personnelCode: '12',
    personnel: '1 RB · 2 TE · 2 WR',
    blurb: 'A balanced two-tight-end surface that can run or release four vertical threats without changing personnel.',
    spots: [
      ...OL,
      { label: 'WR', group: 'receiver', x: 8, y: 50 }, { label: 'TE', group: 'receiver', x: 24, y: 50 },
      { label: 'TE', group: 'receiver', x: 76, y: 50 }, { label: 'WR', group: 'receiver', x: 92, y: 50 },
      { label: 'QB', group: 'backfield', x: 50, y: 59 }, { label: 'RB', group: 'backfield', x: 50, y: 75 },
    ],
  },
  {
    name: 'Shotgun Spread',
    personnelCode: '11',
    personnel: '1 RB · 1 TE · 3 WR',
    blurb: 'The everyday spread set: three wideouts stretch the shell while the back can run, block, or release.',
    spots: [
      ...OL,
      { label: 'WR', group: 'receiver', x: 5, y: 50 }, { label: 'WR', group: 'receiver', x: 19, y: 50 },
      { label: 'TE', group: 'receiver', x: 76, y: 50 }, { label: 'WR', group: 'receiver', x: 94, y: 50 },
      { label: 'RB', group: 'backfield', x: 39, y: 72 }, { label: 'QB', group: 'backfield', x: 50, y: 72 },
    ],
  },
  {
    name: 'Pistol',
    personnelCode: '11',
    personnel: '1 RB · 1 TE · 3 WR',
    blurb: 'The quarterback gets shotgun vision while the back stays directly downhill for either-side run action.',
    spots: [
      ...OL,
      { label: 'WR', group: 'receiver', x: 6, y: 50 }, { label: 'WR', group: 'receiver', x: 20, y: 50 },
      { label: 'TE', group: 'receiver', x: 76, y: 50 }, { label: 'WR', group: 'receiver', x: 93, y: 50 },
      { label: 'QB', group: 'backfield', x: 50, y: 65 }, { label: 'RB', group: 'backfield', x: 50, y: 79 },
    ],
  },
  {
    name: 'Trips',
    personnelCode: '11',
    personnel: '1 RB · 1 TE · 3 WR',
    blurb: 'Three receivers overload one side, forcing the defense to declare how it will match the extra width.',
    spots: [
      ...OL,
      { label: 'WR', group: 'receiver', x: 6, y: 50 }, { label: 'TE', group: 'receiver', x: 76, y: 50 },
      { label: 'WR', group: 'receiver', x: 84, y: 57 }, { label: 'WR', group: 'receiver', x: 94, y: 50 },
      { label: 'RB', group: 'backfield', x: 39, y: 72 }, { label: 'QB', group: 'backfield', x: 50, y: 72 },
    ],
  },
  {
    name: 'Bunch',
    personnelCode: '11',
    personnel: '1 RB · 1 TE · 3 WR',
    blurb: 'Three eligible receivers align tightly to create traffic, free releases, and natural route separation.',
    spots: [
      ...OL,
      { label: 'WR', group: 'receiver', x: 7, y: 50 }, { label: 'TE', group: 'receiver', x: 75, y: 51 },
      { label: 'WR', group: 'receiver', x: 81, y: 57 }, { label: 'WR', group: 'receiver', x: 87, y: 50 },
      { label: 'RB', group: 'backfield', x: 40, y: 72 }, { label: 'QB', group: 'backfield', x: 50, y: 72 },
    ],
  },
  {
    name: 'Empty',
    personnelCode: '10',
    personnel: '1 RB · 0 TE · 4 WR',
    blurb: 'All five eligible receivers detach from the backfield, exposing pressure and coverage before the snap.',
    spots: [
      ...OL,
      { label: 'WR', group: 'receiver', x: 5, y: 50 }, { label: 'WR', group: 'receiver', x: 19, y: 55 },
      { label: 'RB', group: 'backfield', x: 31, y: 55 }, { label: 'WR', group: 'receiver', x: 82, y: 55 },
      { label: 'WR', group: 'receiver', x: 95, y: 50 }, { label: 'QB', group: 'backfield', x: 50, y: 72 },
    ],
  },
  {
    name: 'Flexbone',
    personnelCode: '30',
    personnel: '3 RB · 0 TE · 2 WR',
    blurb: 'A fullback and two slotbacks create immediate triple-option threats across the entire front.',
    spots: [
      ...OL,
      { label: 'WR', group: 'receiver', x: 7, y: 50 }, { label: 'SB', group: 'backfield', x: 25, y: 57 },
      { label: 'SB', group: 'backfield', x: 75, y: 57 }, { label: 'WR', group: 'receiver', x: 93, y: 50 },
      { label: 'QB', group: 'backfield', x: 50, y: 59 }, { label: 'FB', group: 'backfield', x: 50, y: 72 },
    ],
  },
  {
    name: 'Wing-T',
    personnelCode: '31',
    personnel: '3 RB · 1 TE · 1 WR',
    blurb: 'An offset backfield uses motion, misdirection, and multiple lead blockers to hide the ball.',
    spots: [
      ...OL,
      { label: 'WR', group: 'receiver', x: 8, y: 50 }, { label: 'TE', group: 'receiver', x: 76, y: 50 },
      { label: 'WB', group: 'backfield', x: 82, y: 58 }, { label: 'QB', group: 'backfield', x: 50, y: 59 },
      { label: 'FB', group: 'backfield', x: 50, y: 73 }, { label: 'HB', group: 'backfield', x: 37, y: 68 },
    ],
  },
  {
    name: 'Jumbo',
    personnelCode: '13',
    personnel: '1 RB · 3 TE · 1 WR',
    blurb: 'Three tight ends add gaps and blocking surfaces for short-yardage runs while preserving play-action threats.',
    spots: [
      ...OL,
      { label: 'WR', group: 'receiver', x: 8, y: 50 }, { label: 'TE', group: 'receiver', x: 24, y: 50 },
      { label: 'TE', group: 'receiver', x: 76, y: 50 }, { label: 'TE', group: 'receiver', x: 83, y: 56 },
      { label: 'QB', group: 'backfield', x: 50, y: 59 }, { label: 'RB', group: 'backfield', x: 50, y: 75 },
    ],
  },
];

export const DEFENSE_FORMATIONS: Formation[] = [
  {
    name: '4–3 Even',
    personnel: '4 DL · 3 LB · 4 DB',
    blurb: 'A balanced four-man front paired here with two safeties dividing the deep field.',
    shell: shell('Cover 2', 'Two-high shell', 'Two defenders split the deep field into halves.', [zone('Deep ½', 5, 43), zone('Deep ½', 52, 43)]),
    spots: [
      { label: 'DE', group: 'dl', x: 30, y: 48 }, { label: 'DT', group: 'dl', x: 42, y: 47 },
      { label: 'DT', group: 'dl', x: 58, y: 47 }, { label: 'DE', group: 'dl', x: 70, y: 48 },
      { label: 'LB', group: 'lb', x: 36, y: 34 }, { label: 'LB', group: 'lb', x: 50, y: 32 },
      { label: 'LB', group: 'lb', x: 64, y: 34 }, { label: 'CB', group: 'db', x: 10, y: 42 },
      { label: 'CB', group: 'db', x: 90, y: 42 }, { label: 'S', group: 'db', x: 35, y: 18 },
      { label: 'S', group: 'db', x: 65, y: 18 },
    ],
  },
  {
    name: '3–4 Odd',
    personnel: '3 DL · 4 LB · 4 DB',
    blurb: 'A three-man front with stand-up edges, paired here with three deep defenders after the snap.',
    shell: shell('Cover 3', 'One-high shell', 'Three defenders rotate into deep thirds.', [zone('Deep ⅓', 3, 30), zone('Deep ⅓', 35, 30), zone('Deep ⅓', 67, 30)]),
    spots: [
      { label: 'DE', group: 'dl', x: 36, y: 48 }, { label: 'NT', group: 'dl', x: 50, y: 47 },
      { label: 'DE', group: 'dl', x: 64, y: 48 }, { label: 'OLB', group: 'lb', x: 22, y: 38 },
      { label: 'ILB', group: 'lb', x: 42, y: 33 }, { label: 'ILB', group: 'lb', x: 58, y: 33 },
      { label: 'OLB', group: 'lb', x: 78, y: 38 }, { label: 'CB', group: 'db', x: 10, y: 39 },
      { label: 'CB', group: 'db', x: 90, y: 39 }, { label: 'S', group: 'db', x: 42, y: 27 },
      { label: 'S', group: 'db', x: 50, y: 14 },
    ],
  },
  {
    name: 'Nickel 4–2–5',
    personnel: '4 DL · 2 LB · 5 DB',
    blurb: 'The modern passing-down front, shown with four defensive backs sharing the deep field.',
    shell: shell('Cover 4', 'Two-high shell', 'Four defenders each protect a deep quarter.', [zone('¼', 3, 22), zone('¼', 27, 22), zone('¼', 51, 22), zone('¼', 75, 22)]),
    spots: [
      { label: 'DE', group: 'dl', x: 31, y: 48 }, { label: 'DT', group: 'dl', x: 43, y: 47 },
      { label: 'DT', group: 'dl', x: 57, y: 47 }, { label: 'DE', group: 'dl', x: 69, y: 48 },
      { label: 'LB', group: 'lb', x: 42, y: 33 }, { label: 'LB', group: 'lb', x: 58, y: 33 },
      { label: 'CB', group: 'db', x: 9, y: 40 }, { label: 'NB', group: 'db', x: 78, y: 38 },
      { label: 'CB', group: 'db', x: 92, y: 40 }, { label: 'S', group: 'db', x: 38, y: 18 },
      { label: 'S', group: 'db', x: 62, y: 18 },
    ],
  },
  {
    name: '3–3–5 Stack',
    personnel: '3 DL · 3 LB · 5 DB',
    blurb: 'Three stacked linebackers preserve disguise while a three-safety structure caps explosive passes.',
    shell: shell('Three-high', 'Three-safety shell', 'Three safeties stay layered across the deep field.', [zone('Deep', 4, 29), zone('Deep', 35.5, 29), zone('Deep', 67, 29)]),
    spots: [
      { label: 'DE', group: 'dl', x: 37, y: 48 }, { label: 'NT', group: 'dl', x: 50, y: 47 },
      { label: 'DE', group: 'dl', x: 63, y: 48 }, { label: 'LB', group: 'lb', x: 37, y: 35 },
      { label: 'LB', group: 'lb', x: 50, y: 33 }, { label: 'LB', group: 'lb', x: 63, y: 35 },
      { label: 'CB', group: 'db', x: 9, y: 41 }, { label: 'CB', group: 'db', x: 91, y: 41 },
      { label: 'S', group: 'db', x: 31, y: 19 }, { label: 'S', group: 'db', x: 50, y: 14 },
      { label: 'S', group: 'db', x: 69, y: 19 },
    ],
  },
  {
    name: 'Dime 4–1–6',
    personnel: '4 DL · 1 LB · 6 DB',
    blurb: 'Six defensive backs maximize coverage flexibility, paired here with a split-field quarters-and-half call.',
    shell: shell('Cover 6', 'Two-high shell', 'Quarters to one side and a deep half to the other.', [zone('¼', 3, 22), zone('¼', 27, 22), zone('Deep ½', 51, 46)]),
    spots: [
      { label: 'DE', group: 'dl', x: 33, y: 48 }, { label: 'DT', group: 'dl', x: 44, y: 47 },
      { label: 'DT', group: 'dl', x: 56, y: 47 }, { label: 'DE', group: 'dl', x: 67, y: 48 },
      { label: 'LB', group: 'lb', x: 50, y: 34 }, { label: 'CB', group: 'db', x: 8, y: 41 },
      { label: 'NB', group: 'db', x: 22, y: 38 }, { label: 'NB', group: 'db', x: 78, y: 38 },
      { label: 'CB', group: 'db', x: 92, y: 41 }, { label: 'S', group: 'db', x: 38, y: 17 },
      { label: 'S', group: 'db', x: 62, y: 17 },
    ],
  },
  {
    name: '5–2 Front',
    personnel: '5 DL · 2 LB · 4 DB',
    blurb: 'Five defenders cover every interior gap and edge, with a single post safety behind man coverage.',
    shell: shell('Cover 1', 'One-high shell', 'One free safety protects the deep middle behind man coverage.', [zone('Middle', 28, 44)]),
    spots: [
      { label: 'DE', group: 'dl', x: 28, y: 48 }, { label: 'DT', group: 'dl', x: 39, y: 47 },
      { label: 'NT', group: 'dl', x: 50, y: 46 }, { label: 'DT', group: 'dl', x: 61, y: 47 },
      { label: 'DE', group: 'dl', x: 72, y: 48 }, { label: 'LB', group: 'lb', x: 42, y: 33 },
      { label: 'LB', group: 'lb', x: 58, y: 33 }, { label: 'CB', group: 'db', x: 9, y: 41 },
      { label: 'CB', group: 'db', x: 91, y: 41 }, { label: 'S', group: 'db', x: 38, y: 27 },
      { label: 'S', group: 'db', x: 50, y: 14 },
    ],
  },
  {
    name: '4–4 Front',
    personnel: '4 DL · 4 LB · 3 DB',
    blurb: 'Eight defenders crowd the box against heavy run looks while three defenders protect the deep field.',
    shell: shell('Cover 3', 'One-high shell', 'The corners and free safety divide the deep field into thirds.', [zone('Deep ⅓', 3, 30), zone('Deep ⅓', 35, 30), zone('Deep ⅓', 67, 30)]),
    spots: [
      { label: 'DE', group: 'dl', x: 31, y: 48 }, { label: 'DT', group: 'dl', x: 43, y: 47 },
      { label: 'DT', group: 'dl', x: 57, y: 47 }, { label: 'DE', group: 'dl', x: 69, y: 48 },
      { label: 'LB', group: 'lb', x: 23, y: 35 }, { label: 'LB', group: 'lb', x: 42, y: 32 },
      { label: 'LB', group: 'lb', x: 58, y: 32 }, { label: 'LB', group: 'lb', x: 77, y: 35 },
      { label: 'CB', group: 'db', x: 9, y: 38 }, { label: 'CB', group: 'db', x: 91, y: 38 },
      { label: 'S', group: 'db', x: 50, y: 14 },
    ],
  },
  {
    name: 'Goal Line 6–2',
    personnel: '6 DL · 2 LB · 3 DB',
    blurb: 'A compressed, all-gap front built to stop short-yardage runs with no dedicated deep defender.',
    shell: shell('Cover 0', 'Zero-high shell', 'Every eligible receiver is matched with no deep safety help.', []),
    spots: [
      { label: 'DE', group: 'dl', x: 24, y: 48 }, { label: 'DT', group: 'dl', x: 34, y: 47 },
      { label: 'DT', group: 'dl', x: 44, y: 46 }, { label: 'DT', group: 'dl', x: 56, y: 46 },
      { label: 'DT', group: 'dl', x: 66, y: 47 }, { label: 'DE', group: 'dl', x: 76, y: 48 },
      { label: 'LB', group: 'lb', x: 42, y: 34 }, { label: 'LB', group: 'lb', x: 58, y: 34 },
      { label: 'CB', group: 'db', x: 10, y: 40 }, { label: 'S', group: 'db', x: 50, y: 26 },
      { label: 'CB', group: 'db', x: 90, y: 40 },
    ],
  },
];
