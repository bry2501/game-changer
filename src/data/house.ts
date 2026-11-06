/**
 * The Finch house: two floors joined by the hallway stairs, and everything in it
 * that the ghost can search. Clues are hidden among ordinary furniture; most
 * drawers and cupboards hold nothing, or something the ghost recognises as irrelevant.
 *
 * Coordinates: each floor is one screen tall (FLOOR_H). Upstairs (floor 1) sits at
 * world y 0..720, the ground floor (floor 0) at 720..1440. x runs left to right.
 */

export const FLOOR_H = 720;
/** Local y of the floorboards within a floor. */
export const LOCAL_FLOOR_Y = 610;
/** Local y the ghost hovers at. */
export const LOCAL_GHOST_Y = 400;

export const floorTop = (floor: number) => (floor === 1 ? 0 : FLOOR_H);

export interface RoomDef {
  id: string;
  name: string;
  floor: number;
  x0: number;
  x1: number;
  wallTop: number;
  wallBottom: number;
  /** The ghost's thought on first entering. */
  thought: string;
}

export const ROOMS: RoomDef[] = [
  // ground floor
  { id: 'study', name: 'The Study', floor: 0, x0: 0, x1: 1700, wallTop: 0x1b2233, wallBottom: 0x0a0d14, thought: '' },
  {
    id: 'hallway', name: 'The Hallway', floor: 0, x0: 1700, x1: 3500, wallTop: 0x221c2b, wallBottom: 0x0c0a10,
    thought: 'The hallway. Portraits of Finches long gone, their eyes following the draught. Soon, I suppose, mine will hang here too. They will have to find a flattering one.',
  },
  {
    id: 'dining', name: 'The Dining Room', floor: 0, x0: 3500, x1: 5100, wallTop: 0x2a1a1c, wallBottom: 0x0e0809,
    thought: 'The dining room. Twelve chairs, and for years only two of them ever used. The rest stand around the table like guests who never came.',
  },
  {
    id: 'conservatory', name: 'The Conservatory', floor: 0, x0: 5100, x1: 6800, wallTop: 0x14261f, wallBottom: 0x070d0a,
    thought: 'The conservatory. Cold glass, sleeping plants, Margaret’s ferns. That window is open. It never is. I latch it myself every autumn.',
  },
  {
    id: 'office', name: 'The Office', floor: 0, x0: 6800, x1: 8400, wallTop: 0x2a2018, wallBottom: 0x0e0a07,
    thought: 'The office. Twenty years of Finch & Voss in these cabinets, and the smell of paper and lamp oil.',
  },
  // upstairs
  {
    id: 'clara', name: 'Clara’s Room', floor: 1, x0: 1100, x1: 2300, wallTop: 0x2b1b2a, wallBottom: 0x0f0910,
    thought: 'Clara’s room. It still smells of her perfume. She was a little girl in this room, once. I can still hear the stairs, the way they sounded under her.',
  },
  {
    id: 'landing', name: 'The Landing', floor: 1, x0: 2300, x1: 3500, wallTop: 0x1f1d2c, wallBottom: 0x0b0a10,
    thought: 'The landing. The third board creaks. It always has. I cross it and it says nothing. Not for me. Not any more.',
  },
  {
    id: 'library', name: 'The Library', floor: 1, x0: 3500, x1: 5100, wallTop: 0x1d2420, wallBottom: 0x090c0a,
    thought: 'The library. Every book in here is about time. I never found one about how to have more of it.',
  },
  {
    id: 'boxroom', name: 'The Box Room', floor: 1, x0: 5100, x1: 6400, wallTop: 0x23201c, wallBottom: 0x0c0b09,
    thought: 'The box room. Everything we could not bear to throw away, and could not bear to look at.',
  },
];

export const STAIRS_X = 2900;

export const BODY_X = 300;
export const AWAKEN_X = 1080;
export const CLOCK_X = 760;
export const WINDOW_X = 570;

export const floorBounds = (floor: number) => {
  const rooms = ROOMS.filter((r) => r.floor === floor);
  return { min: Math.min(...rooms.map((r) => r.x0)) + 60, max: Math.max(...rooms.map((r) => r.x1)) - 60 };
};

export const roomAt = (floor: number, x: number) =>
  ROOMS.find((r) => r.floor === floor && x >= r.x0 && x < r.x1) ?? ROOMS.find((r) => r.floor === floor)!;

/**
 * How a searchable is drawn and opened:
 * - drawer: a piece of furniture whose drawer slides out
 * - cabinet: a tall cupboard whose door swings open
 * - move: an object that slides aside to reveal what is behind or under it
 * - plain: something lying in plain sight (no furniture of its own)
 * - stairs: the way up or down
 */
export type SearchKind = 'drawer' | 'cabinet' | 'move' | 'plain' | 'stairs';

export interface Searchable {
  id: string;
  floor: number;
  x: number;
  kind: SearchKind;
  /** Shown when the ghost is close, e.g. "Writing desk". */
  label: string;
  /** Clue id (or 'prior') hidden here. */
  holds?: string;
  /** Thoughts when the search turns up nothing that matters. */
  noise?: string[];
  /** Furniture size (drawer / cabinet / move). */
  w?: number;
  h?: number;
}

export const SEARCHABLES: Searchable[] = [
  // ---------------------------------------------------------------- the study
  { id: 'log', floor: 0, x: 620, kind: 'plain', label: 'Household log', holds: 'prior' },
  {
    id: 'teacup', floor: 0, x: 930, kind: 'plain', label: 'My teacup', holds: 'teacup',
    noise: ['My teacup, still half full, a brown tide-mark drying on the china.', 'I can’t bear to look at it for long. Let me look elsewhere.'],
  },
  {
    id: 'study-desk', floor: 0, x: 1090, kind: 'drawer', label: 'Desk drawer', w: 120, h: 30,
    noise: ['Pencils, a jeweller’s loupe, spare mainsprings coiled like sleeping snakes.', 'All mine. Nothing to do with tonight.'],
  },
  {
    id: 'chair', floor: 0, x: 1320, kind: 'move', label: 'Desk chair', holds: 'cufflink', w: 70, h: 120,
    noise: ['Just my chair. Nothing under it.'],
  },
  {
    id: 'bookshelf', floor: 0, x: 120, kind: 'cabinet', label: 'Bookshelf', w: 160, h: 380,
    noise: ['Clock-repair manuals. Forty years of them, spines cracked and thumbed soft.', 'No secret compartments. I would know: I built this shelf.'],
  },

  // ---------------------------------------------------------------- hallway
  {
    id: 'coats', floor: 0, x: 2050, kind: 'move', label: 'Coat stand', w: 60, h: 200,
    noise: ['Coats. Graves’s umbrella, hung up neatly as always. A glove nobody owns...', '...no, it’s mine. I lost it in March. Not a clue, just a glove.'],
  },
  {
    id: 'phone-table', floor: 0, x: 2420, kind: 'drawer', label: 'Telephone table', holds: 'phone', w: 110, h: 30,
    noise: ['The telephone directory and a pencil stub. Nothing more.'],
  },
  { id: 'stairs-up', floor: 0, x: STAIRS_X, kind: 'stairs', label: 'Float upstairs' },
  {
    id: 'console', floor: 0, x: 3300, kind: 'drawer', label: 'Hall console', w: 140, h: 26,
    noise: ['Spare keys and a church bulletin from last Sunday, the hymn numbers circled in my own pencil.'],
  },

  // ---------------------------------------------------------------- dining room
  {
    id: 'sideboard', floor: 0, x: 3850, kind: 'drawer', label: 'Sideboard', w: 220, h: 34,
    noise: ['The good silver. Polished, every piece accounted for.', 'Whoever did this didn’t come for the spoons.'],
  },
  {
    id: 'tablecloth', floor: 0, x: 4300, kind: 'move', label: 'Under the table', w: 260, h: 90,
    noise: ['Crumbs from supper, and a button off my own waistcoat. So that is where it went.', 'Nothing that matters.'],
  },
  {
    id: 'china', floor: 0, x: 4800, kind: 'cabinet', label: 'China cabinet', w: 130, h: 300,
    noise: ['Our wedding china. We used it twice.', 'A strange thing to feel sad about, when you are dead. Moving on.'],
  },

  // ---------------------------------------------------------------- conservatory
  {
    id: 'cans', floor: 0, x: 5350, kind: 'move', label: 'Watering cans', w: 80, h: 60,
    noise: ['Watering cans. One has a frog in it.', 'The frog is not a suspect.'],
  },
  {
    id: 'fern', floor: 0, x: 5750, kind: 'move', label: 'Big fern', holds: 'boot', w: 90, h: 70,
    noise: ['Only the fern’s roots, curling out of the pot.'],
  },
  {
    id: 'potting', floor: 0, x: 6350, kind: 'cabinet', label: 'Potting cupboard', holds: 'greenhouse', w: 110, h: 170,
    noise: ['Seed packets, twine and a trowel, all in Margaret’s labelled order. Nothing about tonight.'],
  },

  // ---------------------------------------------------------------- office
  {
    id: 'filing', floor: 0, x: 7000, kind: 'cabinet', label: 'Filing cabinet', w: 100, h: 200,
    noise: ['Invoices for brass, glass and lamp oil.', 'Ordinary business. Twenty years of it.'],
  },
  {
    id: 'voss-desk', floor: 0, x: 7500, kind: 'drawer', label: 'Voss’s desk', holds: 'ledger', w: 130, h: 30,
    noise: ['Voss’s fountain pens, lined up perfectly. He was always so tidy.'],
  },
  {
    id: 'safe', floor: 0, x: 8150, kind: 'cabinet', label: 'The safe', w: 110, h: 130,
    noise: ['The safe is locked, as it should be.', 'I never could remember the combination. Now I never will.'],
  },

  // ---------------------------------------------------------------- upstairs: Clara's room
  {
    id: 'vanity', floor: 1, x: 1300, kind: 'drawer', label: 'Vanity table', w: 120, h: 28,
    noise: ['Hairpins, and a train ticket home dated next Friday.', 'She was leaving soon anyway. That proves nothing either way.'],
  },
  {
    id: 'writing-desk', floor: 1, x: 1650, kind: 'drawer', label: 'Writing desk', holds: 'letter', w: 130, h: 30,
    noise: ['Writing paper, a pressed violet. Nothing else.'],
  },
  {
    id: 'wardrobe', floor: 1, x: 2050, kind: 'cabinet', label: 'Wardrobe', w: 140, h: 330,
    noise: ['Dresses and a travelling coat, smelling of cedar.', 'Nothing hidden here.'],
  },

  // ---------------------------------------------------------------- upstairs: landing
  { id: 'stairs-down', floor: 1, x: STAIRS_X, kind: 'stairs', label: 'Float downstairs' },
  {
    id: 'linen', floor: 1, x: 3250, kind: 'cabinet', label: 'Linen chest', w: 150, h: 90,
    noise: ['Linens that smell of lavender. My wife chose that smell.', 'Not evidence. Just something I had forgotten I missed.'],
  },

  // ---------------------------------------------------------------- upstairs: library
  {
    id: 'hollow-book', floor: 1, x: 3850, kind: 'move', label: 'A book that sticks out', w: 40, h: 60,
    noise: ['A hollow book! Inside it...', '...a pressed rose, and a note in my own hand: “For Margaret.”', 'A dead end. A sweet one.'],
  },
  {
    id: 'reading-desk', floor: 1, x: 4550, kind: 'drawer', label: 'Reading desk', w: 140, h: 30,
    noise: ['My first repair ledger, from 1961, the entries in a boy’s careful writing.', 'Memories, not evidence.'],
  },

  // ---------------------------------------------------------------- upstairs: box room
  {
    id: 'trunk', floor: 1, x: 5450, kind: 'cabinet', label: 'Old trunk', w: 170, h: 90,
    noise: ['Toys from when Clara was small. A wooden clock I carved for her.', 'It still ticks. That is not a clue. It is just unbearable.'],
  },
  {
    id: 'hatboxes', floor: 1, x: 6000, kind: 'move', label: 'Hat boxes', w: 90, h: 110,
    noise: ['Dust. Only dust.', 'Somebody’s grandmother’s hats, waiting in the dark for heads.'],
  },
];
