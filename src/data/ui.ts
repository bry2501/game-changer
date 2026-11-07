/** Fixed words the evidence screens use, shared with the screenplay generator. */
export const RATING_WORDS = ['Very unlikely', 'Unlikely', 'As likely as not', 'Likely', 'Very likely'];
export const RATING_VALUES = [0.1, 0.3, 0.5, 0.7, 0.9];
export const KEEP_WORDS = ['keeps very little', 'keeps less than half', 'keeps half', 'keeps most', 'keeps almost all'];
export const UNCHANGED = 'Neither story fits this clue better, so nothing moves.';

/** The update, as a square of possible worlds. {n} is the number of suspects, in words. */
export const UPDATE_STEPS: [string, string, string][] = [
  [
    'Before',
    'Before the clue. The square holds every way tonight could have gone. Each person’s column is as wide as their share of my suspicion. Together they fill the whole square.',
    'Width of a column: that person’s share of suspicion.',
  ],
  [
    'Step 1 of 3: shrink',
    'Each share shrinks by how well the clue fits that person’s story. A good fit keeps most of it; a poor fit keeps little. The shaded part is what is left; the faded part is what the clue took away.',
    'Shaded height: how often this clue turns up in that story (your rating).',
  ],
  [
    'Step 2 of 3: together',
    'Put what’s left side by side. It no longer fills the whole square, because the clue took a piece of every share. The less that’s left, the more unusual this clue was across both stories; the more, the more ordinary.',
    'Shaded pieces: the worlds that fit this clue. Everything else is ruled out.',
  ],
  [
    'Step 3 of 3: stretch',
    'Stretch what’s left back to the full square, keeping the proportions. Whoever kept more than the others grows; whoever kept less shrinks. This is only fair because these {n} stories cover every possibility between them.',
    'New widths: the new shares. Dashed line: where the old border was.',
  ],
];
