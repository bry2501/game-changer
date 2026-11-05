/**
 * Case 1: "The Clockmaker's Last Hour".
 * All story content and the probability model live here as data.
 * The full case has four suspects; each difficulty plays a subset of them
 * (Easy 2, Medium 3, Hard 4) with the clues that matter for that subset.
 * Call setCase(difficulty) before playing: SUSPECTS, CLUES, CULPRIT_INDEX and
 * PRIOR_SHEET are live bindings that always describe the active case.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Suspect {
  id: string;
  name: string;
  role: string;
  color: number;
  /** Hours spent inside the house between 6 pm and 10 pm: the basis of the prior. */
  hoursInside: number;
  /** What the ghost remembers about them when memory returns. */
  memory: string;
  /** Why they were not in the house, for difficulties that leave them out. */
  absent: string;
}

export interface Clue {
  id: string;
  room: number;
  x: number;
  title: string;
  /** What the ghost sees. */
  text: string;
  /** Why it matters: the narrative context before any analysis. */
  context: string;
  /** Short name used in questions: "How likely would I be to find ___?" */
  short: string;
  /** P(this clue | suspect i is the culprit). */
  likelihoods: number[];
  /** Plain-language reasoning for each likelihood (shown as hints; the only info in Hard mode). */
  reasons: string[];
  /** Name of the reasoning trap this clue is built around. */
  trap: string;
  /** Explanation shown after the update. */
  lesson: string;
  /** The ghost's inner voice right after the clue: first the gut, then the reflective voice. */
  reaction: string[];
  /** The ghost's thought pointing toward the next clue (or back to the body). */
  nextThought: string;
}

/** Authoring form of a clue. Lessons may contain {butler} {niece} {partner} {gardener},
 *  replaced by that suspect's true posterior after this clue in the active case. */
interface ClueSource extends Omit<Clue, 'nextThought'> {
  /** The ghost's thought that points toward THIS clue. */
  leadIn: string;
  /** Overrides for Easy, where only Clara and Voss are suspects. */
  lessonEasy?: string;
  trapEasy?: string;
  reactionEasy?: string[];
}

export interface Room {
  name: string;
  /** Top and bottom gradient colours of the room's back wall. */
  wallTop: number;
  wallBottom: number;
}

export const ROOM_WIDTH = 1280;

export const CASE_TITLE = "The Clockmaker's Last Hour";

const ALL_SUSPECTS: Suspect[] = [
  { id: 'butler', name: 'Graves', role: 'the butler', color: 0x8fb3ff, hoursInside: 3.5,
    memory: 'My butler for thirty years. He brings my tea at nine every night, as he has since my wife passed. He says little, and notices everything.',
    absent: 'Graves had the evening off and was visiting his sister.' },
  { id: 'niece', name: 'Clara', role: 'the niece', color: 0xff9fc6, hoursInside: 3,
    memory: 'My niece, bright and stubborn, staying with us this week. We argued about my will. I said things I regret.',
    absent: '' },
  { id: 'partner', name: 'Mr. Voss', role: 'the business partner', color: 0xffd27a, hoursInside: 2,
    memory: 'My partner at Finch & Voss Clockworks for twenty years. He came this afternoon with papers to sign, and smiled a little too much.',
    absent: '' },
  { id: 'gardener', name: 'Pip', role: 'the gardener', color: 0x9ff0b0, hoursInside: 1.5,
    memory: 'The gardener. Muddy boots, kind eyes. He talks to the orchids more than to people, and keeps careful notes on every one.',
    absent: 'Pip went home at six, as he always does.' },
];


export const ROOMS: Room[] = [
  { name: 'The Study', wallTop: 0x1b2233, wallBottom: 0x0a0d14 },
  { name: 'The Hallway', wallTop: 0x221c2b, wallBottom: 0x0c0a10 },
  { name: 'The Conservatory', wallTop: 0x14261f, wallBottom: 0x070d0a },
  { name: 'The Office', wallTop: 0x2a2018, wallBottom: 0x0e0a07 },
];

export const BODY_X = 300;

/** Where the ghost first flickers into existence. */
export const AWAKEN_X = 860;

/** Thrown into ghostly existence: no memory, no context. */
export const AWAKEN_LINES: string[] = [
  '...',
  'Where... am I?',
  'Cold. Quiet. Only the ticking of clocks. So many clocks.',
  'I don\u2019t remember arriving here. I don\u2019t remember... anything.',
  'There is something on the rug. A shape, lying very still.',
];

/** Shown once the player can move. */
export const DRIFT_HINT = 'I feel weightless. If I reach toward something, I drift to it.';

/** Discovering the body. */
export const BODY_LINES: string[] = [
  'Someone is lying here. So still. As if asleep.',
  'That coat. Those hands. The ink stain on the left cuff...',
  '...it\u2019s me.',
  'I am Alistair Finch. I make clocks. I made clocks.',
  'No wound, nothing broken. Just... asleep, for good.',
  'My evening tea. It tasted bitter tonight.',
  'Someone did this to me.',
];

export const MEMORY_INTRO =
  'Faces rise out of the fog, one by one. The people who were in the house tonight.';

export const MEMORY_OUTRO = [
  'One of them did this.',
  'Already my gut whispers a name. But a gut feeling is how the living get things wrong.',
  'I will gather what I can find, and weigh each piece honestly.',
];

export const AFTER_MEMORY_THOUGHTS: string[] = [
  'Where to begin...',
  'Everyone who comes and goes signs the household log. It should be on the side table.',
];

/** The first time the ghost drifts into each room. */
export const ROOM_THOUGHTS: string[] = [
  '',
  'The hallway. Portraits of Finches long gone. Soon, I suppose, mine will hang here too.',
  'The conservatory. Cold glass, sleeping plants. That window is open. It never is.',
  'The office. Twenty years of Finch & Voss in these ledgers.',
];

/** The opportunity sheet that sets the prior. {total}, {top} and {absent} are filled in per case. */
const PRIOR_SOURCE = {
  id: 'log',
  room: 0,
  x: 620,
  title: 'The Household Log',
  text:
    'Everyone signs the household log when they come and go. It shows who was inside tonight between 6 pm and 10 pm, and for how long.{absent}',
  context:
    'Before I weigh a single clue, I need a starting point. The longer someone was inside, the more chances they had to reach my tea. ' +
    'That starting belief is called the PRIOR.',
  lesson:
    'Prior = opportunity. Divide each person\u2019s hours inside by the total ({total} hours). ' +
    '{top} starts as the most likely suspect, but only because of the time spent in the house.',
  reaction: [
    '{top} was here the longest, so starts as the likeliest. That is opportunity, not guilt.',
    'Every clue from now on should shift these numbers. By how much is the whole question.',
  ],
};

const ALL_CLUES: ClueSource[] = [
  {
    id: 'teacup',
    short: 'Graves\u2019s fingerprints on my teacup',
    context:
      'The sleeping draught was in my tea, so whoever handled this cup had a chance to slip it in. But a teacup passes through hands for innocent reasons too.',
    leadIn: 'My teacup is still on the desk...',
    room: 0,
    x: 930,
    title: 'Fingerprints on the Teacup',
    text: 'Graves’s fingerprints are all over my teacup. The one that held the sleeping draught!',
    likelihoods: [0.95, 0.9, 0.9, 0.9],
    reasons: [
      'Graves serves my tea every night. His prints would be there almost no matter what: very likely.',
      'If Clara did it, Graves still brought the tea: his prints are still very likely.',
      'If Voss did it, Graves still brought the tea: his prints are still very likely.',
      'If Pip did it, Graves still brought the tea: his prints are still very likely.',
    ],
    trap: 'Non-diagnostic evidence',
    lesson:
      'It FEELS damning, but evidence that is almost equally likely whatever happened barely moves anything. ' +
      'The likelihood ratio is about 1.06. Graves barely moves.',
    reaction: [
      'Graves\u2019s prints! It must be Graves.',
      '...But he carries that cup every single night. Of course his prints are on it.',
    ],
  },
  {
    id: 'letter',
    short: 'an angry letter like this',
    context:
      'Clara and I quarrelled about my will. A letter like this shows strong feelings, maybe even a motive. But strong feelings are common, and poisoning is rare.',
    leadIn: 'I heard paper rustling in the hallway...',
    room: 1,
    x: 1900,
    title: 'An Angry Letter',
    text:
      'A crumpled letter from Clara: "Uncle, if you change your will, I will NEVER forgive you!"',
    likelihoods: [0.3, 0.6, 0.3, 0.3],
    reasons: [
      'If Graves did it, the quarrel with Clara happened anyway, and the letter could still turn up: 0.3.',
      'If Clara were the culprit, an angry letter fits: twice as likely as otherwise, 0.6.',
      'If Voss did it, the quarrel with Clara happened anyway, and the letter could still turn up: 0.3.',
      'If Pip did it, the quarrel with Clara happened anyway, and the letter could still turn up: 0.3.',
    ],
    trap: 'Vivid but weak evidence',
    lesson:
      'Angry words are dramatic, but plenty of people write angry letters and harm no one. ' +
      'The likelihood ratio is only 2: it doubles Clara’s odds, making her the top suspect at {niece}. That is not a confession.',
    reaction: [
      'Clara. She was so angry with me...',
      'Anger makes a vivid story. But a vivid story isn\u2019t the same as a likely one.',
    ],
  },
  {
    id: 'boot',
    short: 'a muddy print under that window',
    context:
      'Someone came or went through the garden tonight, by a window that is never open. Who would be likely to leave a print like this?',
    leadIn: 'A cold draft blows in from the conservatory...',
    room: 2,
    x: 3000,
    title: 'A Muddy Boot Print',
    text: 'A muddy boot print below the open conservatory window. Mud from the garden beds.',
    likelihoods: [0.1, 0.1, 0.5, 0.8],
    reasons: [
      'Graves never goes through the garden at night: unlikely, 0.1.',
      'Clara’s room is upstairs, far from the garden: unlikely, 0.1.',
      'Voss parks by the garden gate and walks across the beds: a fair chance, 0.5.',
      'Pip’s boots are ALWAYS muddy and he walks through here: likely, 0.8.',
    ],
    trap: 'Representativeness ("mud means gardener")',
    lesson:
      'Mud screams "gardener!", but Voss would also leave prints, and Pip started with the lowest prior. ' +
      'Prior × likelihood: Pip {gardener} vs Voss {partner}. The clue points to the GARDEN, not one person.',
    trapEasy: 'A large likelihood ratio flips the lead',
    lessonEasy:
      'Clara\u2019s room is upstairs, while Voss parks by the garden gate. Mud is 5\u00D7 more likely if Voss did it, ' +
      'so this one clue flips the lead: Voss is now {partner}. A large likelihood ratio moves belief a lot.',
    reactionEasy: [
      'Garden mud, under the open window. Who walks through the garden at night?',
      'Not Clara: her room is upstairs. But Voss parks by the garden gate...',
    ],
    reaction: [
      'Garden mud. Pip, surely. It has to be Pip.',
      'Or anyone who came in through the garden gate tonight. Pip started as the least likely of all.',
    ],
  },
  {
    id: 'ledger',
    short: 'a ledger like this',
    context:
      'Money is missing from Finch & Voss Clockworks. If someone was stealing from me and feared I would find out, that would be a reason to silence me.',
    leadIn: 'Voss always kept the partnership books in the office...',
    room: 3,
    x: 4300,
    title: 'The Partnership Ledger',
    text:
      'The ledger for Finch & Voss Clockworks. Large sums are missing, and the entries are in Voss’s handwriting.',
    likelihoods: [0.2, 0.2, 0.7, 0.2],
    reasons: [
      'If Graves did it, missing money in the books is an unrelated mess: 0.2.',
      'If Clara did it, the ledger is unrelated: 0.2.',
      'If Voss did it, hiding theft is a strong reason, and the ledger would likely look like this: 0.7.',
      'If Pip did it, the ledger is unrelated: 0.2.',
    ],
    trap: 'Motive evidence (genuinely diagnostic)',
    lesson:
      'THIS clue is diagnostic: it is 3.5× more likely if Voss is guilty than if anyone else is. ' +
      'Voss is now at {partner}. Notice that it took a strong likelihood ratio, not a vivid story.',
    reaction: [
      'Voss. My partner. Stealing from me?',
      'This clue fits one person far better than anyone else. That is what strong evidence feels like.',
    ],
  },
  {
    id: 'phone',
    short: 'this telephone log',
    context:
      'My tea was poured at about 9:40. Anyone on the telephone at that exact moment could hardly have been in my study at the same time.',
    leadIn: 'The telephone switchboard log is on the office desk...',
    room: 3,
    x: 4800,
    title: 'The Telephone Log',
    text:
      'The switchboard log: Clara was on a long-distance call from 9:35 to 9:50 pm, just when my tea was poured.',
    likelihoods: [1, 0.1, 1, 1],
    reasons: [
      'Clara’s call has nothing to do with Graves: certain to appear either way, 1.0.',
      'If Clara poured the draught, she could hardly be on the phone at that moment: 0.1.',
      'Unrelated to Voss: 1.0.',
      'Unrelated to Pip: 1.0.',
    ],
    trap: 'Exculpatory evidence',
    lesson:
      'Evidence can clear people too. An alibi makes the clue 10× LESS likely under "Clara did it". ' +
      'Her probability collapses to {niece}, and the others share what she loses.',
    reaction: [
      'Clara was on the telephone when my tea was poured.',
      'I am almost relieved. An alibi is evidence too: it pushes belief away from someone.',
    ],
  },
  {
    id: 'greenhouse',
    short: 'Pip\u2019s careful greenhouse log',
    context:
      'Pip\u2019s notes put him in the greenhouse all evening, writing every ten minutes. Would someone busy poisoning my tea keep such a steady record?',
    leadIn: 'Pip keeps a greenhouse log... back in the conservatory.',
    room: 2,
    x: 3500,
    title: 'The Greenhouse Log',
    text:
      'Pip’s greenhouse log: temperatures written down every ten minutes from 9:00 to 10:00 pm, in his handwriting.',
    likelihoods: [1, 1, 1, 0.15],
    reasons: [
      'Pip’s log has nothing to do with Graves: 1.0.',
      'Unrelated to Clara: 1.0.',
      'Unrelated to Voss: 1.0.',
      'Pip could have faked a few entries, but it’s unlikely he’d keep up a careful log while poisoning tea: 0.15.',
    ],
    trap: 'Exculpatory evidence (weighing against the earlier clue)',
    lesson:
      'Remember the boot print that pointed at Pip? This alibi cancels most of it. ' +
      'Bayesian updating lets evidence add up AND cancel out. Pip drops to {gardener}.',
    reaction: [
      'Dear Pip, counting temperatures while I fell asleep for good.',
      'The mud pointed at him; this points away. Evidence can cancel out evidence.',
    ],
  },
  {
    id: 'cufflink',
    short: 'a \u201CV\u201D cufflink under my desk',
    context:
      'Voss wears cufflinks like this. But he also sat at this very desk this afternoon, hours before anything happened.',
    leadIn: 'Something glinted under my desk in the study...',
    room: 0,
    x: 1110,
    title: 'A Cufflink Engraved "V"',
    text: 'Under my desk: a silver cufflink engraved with a "V". Voss came for a business meeting at 4 pm.',
    likelihoods: [0.3, 0.3, 0.6, 0.3],
    reasons: [
      'If Graves did it, Voss could still have lost it at the afternoon meeting: 0.3.',
      'If Clara did it, Voss could still have lost it at the afternoon meeting: 0.3.',
      'If Voss came back tonight, a dropped cufflink is more likely: 0.6.',
      'If Pip did it, Voss could still have lost it at the afternoon meeting: 0.3.',
    ],
    trap: "Prosecutor's fallacy",
    lesson:
      'P(cufflink | Voss guilty) = 0.6, but that is NOT P(Voss guilty | cufflink). ' +
      'On its own this clue is weak (likelihood ratio 2). What convicts Voss is ALL the evidence together: {partner}.',
    reaction: [
      'Voss\u2019s cufflink. But he sat at this desk this afternoon...',
      'On its own it proves little. Together with everything else, the picture is clear.',
    ],
  },
];

export const EPILOGUE_CORRECT = [
  'Voss. My partner of twenty years.',
  'He was stealing from the business. I was about to discover it, so he came back through the garden while the house was quiet.',
  'The loudest clues were not the strongest ones.',
  'The ledger, the alibis and the cufflink were quiet, and together they spoke clearly.',
  'The clocks slow down... and for the first time tonight, I can rest.',
];

export const EPILOGUE_WRONG = [
  'The accusation echoes through the empty house... and nothing happens.',
  'The clocks keep ticking. The case is not closed.',
  'Perhaps a loud clue drowned out the quiet ones?',
];

export const FINAL_THOUGHT = 'I have seen enough. Time to return to my body and name the culprit.';

/** Which suspects and clues each difficulty plays (always including the culprit, Voss). */
export const CASE_SETUP: Record<Difficulty, { suspects: string[]; clues: string[] }> = {
  easy: { suspects: ['niece', 'partner'], clues: ['letter', 'boot', 'ledger', 'phone', 'cufflink'] },
  medium: {
    suspects: ['niece', 'partner', 'gardener'],
    clues: ['letter', 'boot', 'ledger', 'phone', 'greenhouse', 'cufflink'],
  },
  hard: {
    suspects: ['butler', 'niece', 'partner', 'gardener'],
    clues: ['teacup', 'letter', 'boot', 'ledger', 'phone', 'greenhouse', 'cufflink'],
  },
};

// ---------------------------------------------------------------- the active case (live bindings)

export let SUSPECTS: Suspect[] = [];
export let CLUES: Clue[] = [];
export let CULPRIT_INDEX = 0;
export let PRIOR_SHEET = { ...PRIOR_SOURCE, nextThought: '', total: 0 };

function fmtPct(x: number) {
  return `${Math.round(x * 100)}%`;
}

/** Select the suspects and clues for a difficulty and resolve every text template. */
export function setCase(difficulty: Difficulty) {
  const setup = CASE_SETUP[difficulty];
  const idx = setup.suspects.map((id) => ALL_SUSPECTS.findIndex((s) => s.id === id));
  SUSPECTS = idx.map((i) => ALL_SUSPECTS[i]);
  CULPRIT_INDEX = SUSPECTS.findIndex((s) => s.id === 'partner');
  const sources = setup.clues.map((id) => ALL_CLUES.find((c) => c.id === id)!);

  // true prior and posterior chain, to fill the {suspect} placeholders
  const total = SUSPECTS.reduce((a, s) => a + s.hoursInside, 0);
  let belief = SUSPECTS.map((s) => s.hoursInside / total);
  const fill = (t: string, dist: number[]) =>
    t.replace(/\{(butler|niece|partner|gardener)\}/g, (_m, id: string) => {
      const k = SUSPECTS.findIndex((s) => s.id === id);
      return k < 0 ? '' : fmtPct(dist[k]);
    });

  CLUES = sources.map((src, n) => {
    const likelihoods = idx.map((i) => src.likelihoods[i]);
    const joint = belief.map((p, k) => p * likelihoods[k]);
    const z = joint.reduce((a, b) => a + b, 0);
    belief = joint.map((j) => j / z);
    const easy = difficulty === 'easy';
    return {
      id: src.id,
      room: src.room,
      x: src.x,
      title: src.title,
      text: src.text,
      context: src.context,
      short: src.short,
      likelihoods,
      reasons: idx.map((i) => src.reasons[i]),
      trap: (easy && src.trapEasy) || src.trap,
      lesson: fill((easy && src.lessonEasy) || src.lesson, belief),
      reaction: (easy && src.reactionEasy) || src.reaction,
      nextThought: n + 1 < sources.length ? sources[n + 1].leadIn : FINAL_THOUGHT,
    };
  });

  const top = SUSPECTS.reduce((a, s) => (s.hoursInside > a.hoursInside ? s : a));
  const absentNotes = ALL_SUSPECTS.filter((s) => !setup.suspects.includes(s.id)).map((s) => s.absent);
  const fillPrior = (t: string) =>
    t
      .replace('{total}', String(total))
      .replace('{top}', top.name)
      .replace('{absent}', absentNotes.length ? ' ' + absentNotes.join(' ') : '');
  PRIOR_SHEET = {
    ...PRIOR_SOURCE,
    text: fillPrior(PRIOR_SOURCE.text),
    total,
    lesson: fillPrior(PRIOR_SOURCE.lesson),
    reaction: PRIOR_SOURCE.reaction.map(fillPrior),
    nextThought: sources[0].leadIn,
  };
}

setCase('hard');
