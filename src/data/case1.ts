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
  /** How the household log shows them when they were not in the house. */
  absentLog: [string, string];
  /** Who they are to Alistair, and what they might have to gain or lose. */
  backstory: string;
  /** What they did tonight (consistent with the household log). */
  tonight: string;
  /** The household log entry, e.g. "in 6:00 pm \u2013 out 9:30 pm". Must span hoursInside. */
  logIn: string;
  logOut: string;
}

/**
 * The evidence itself, exactly as found, with no interpretation:
 * - letter: a handwritten note
 * - table: a log or ledger (rows of columns)
 * - facts: plain observations of a physical object
 */
export type Evidence =
  | { kind: 'letter'; date: string; lines: string[]; sign: string }
  | { kind: 'table'; columns: string[]; rows: string[][]; foot?: string; widths?: number[] }
  | { kind: 'facts'; rows: [string, string][] };

export interface Clue {
  id: string;
  title: string;
  /** Where it was found (shown as a caption outside the evidence card). */
  found: string;
  /** The evidence itself, as found. */
  evidence: Evidence;
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
  /** Explanation shown after the update (numbers filled from the ghost's own chain). */
  lesson: string;
  /** The same lesson with {butler} {niece} {partner} {gardener} placeholders, to fill with any posterior. */
  lessonTemplate: string;
  /** The ghost's inner voice right after the clue: first the gut, then the reflective voice. */
  reaction: string[];
  /** The ghost's thought pointing toward the next clue (or back to the body). */
  nextThought: string;
}

/** Authoring form of a clue. Lessons may contain {butler} {niece} {partner} {gardener},
 *  replaced by that suspect's true posterior after this clue in the active case. */
interface ClueSource extends Omit<Clue, 'nextThought' | 'lessonTemplate'> {
  /** The ghost's thought that points toward THIS clue. */
  leadIn: string;
  /** Overrides for Easy, where only Clara and Voss are suspects. */
  lessonEasy?: string;
  trapEasy?: string;
  reactionEasy?: string[];
}


export const CASE_TITLE = "The Clockmaker's Last Hour";

const ALL_SUSPECTS: Suspect[] = [
  {
    id: 'butler', name: 'Graves', role: 'the butler', color: 0x8fb3ff, hoursInside: 3.5,
    memory: 'My butler for thirty years. He says little, and notices everything.',
    backstory:
      'Graves came to us the year Margaret and I married, barely twenty and terrified of the silver. He nursed this house through her long illness ' +
      'and never once complained. He has no family but a sister in town, and no money of his own. My will leaves him a small sum.',
    tonight: 'He served supper, brought my tea at half past nine as always, then signed out to visit his sister.',
    logIn: '6:00 pm', logOut: '9:30 pm',
    absent: 'Graves had the evening off and was visiting his sister.',
    absentLog: ['\u2014', 'not in tonight (evening off)'],
  },
  {
    id: 'niece', name: 'Clara', role: 'the niece', color: 0xff9fc6, hoursInside: 3,
    memory: 'My brother\u2019s girl. Bright, stubborn, and the closest thing I have to a daughter.',
    backstory:
      'Her parents died when she was twelve, and she grew up in this house, all elbows and questions. Now she studies law in the city and argues like a barrister. ' +
      'This week I told her I meant to leave the house to the Clockmakers\u2019 Guild instead of to her. We both said things we regret.',
    tonight: 'She came back from a long walk at seven and spent the evening upstairs. I heard her on the telephone.',
    logIn: '7:00 pm', logOut: '10:00 pm (still in)',
    absent: '',
    absentLog: ['', ''],
  },
  {
    id: 'partner', name: 'Mr. Voss', role: 'the business partner', color: 0xffd27a, hoursInside: 2,
    memory: 'Edmund Voss, my partner at Finch & Voss Clockworks. He smiles a little too much.',
    backstory:
      'We founded the business twenty years ago: my hands, his head for numbers. It made us both comfortable. ' +
      'But lately the accounts stopped making sense to me, and last week I told him I wanted to go through the books myself.',
    tonight: 'He came at four with papers to sign, stayed to supper, and signed out at eight.',
    logIn: '6:00 pm', logOut: '8:00 pm',
    absent: '',
    absentLog: ['', ''],
  },
  {
    id: 'gardener', name: 'Pip', role: 'the gardener', color: 0x9ff0b0, hoursInside: 1.5,
    memory: 'The gardener. Muddy boots, kind eyes, and hardly a word to anyone.',
    backstory:
      'Pip has tended this garden since he was a boy, as his father did before him. He knows every plant by its Latin name and writes the greenhouse temperature down every ten minutes, ' +
      'as if the orchids might die without the numbers. Last month I told him I might sell the greenhouse.',
    tonight: 'He ate supper in the kitchen and mended the boiler, then went out to the greenhouse for the rest of the evening.',
    logIn: '6:00 pm', logOut: '7:30 pm (to the greenhouse)',
    absent: 'Pip went home at six, as he always does.',
    absentLog: ['\u2014', 'out 6:00 pm (went home)'],
  },
];



/** Thrown into ghostly existence: no memory, no context. */
export const AWAKEN_LINES: string[] = [
  '...',
  '...',
  'Where... am I?',
  'Dark. Cold. Somewhere, a clock is ticking. No... many clocks.',
  'I don\u2019t remember arriving here.',
  'I don\u2019t remember anything at all. Not even my own name.',
];

/** Beat: drifting to the grandfather clock and reaching for it. */
export const CLOCK_LINES: string[] = [
  'A grandfather clock. I know this clock. The way it leans, just slightly...',
  'Did I... make it?',
  'Let me steady myself on it...',
];
export const CLOCK_AFTER: string[] = [
  'My hand went straight through.',
  'As if the clock were the real thing, and I were the shadow.',
];

/** Beat: the window that shows no reflection. */
export const WINDOW_LINES: string[] = [
  'The window. Moonlight on the garden.',
  'There should be a face looking back at me.',
  'There is nothing. Only the room behind me, and the moon.',
  'What... am I?',
];

/** Shown once the player can move again. */
export const DRIFT_HINT = 'Something is lying on the rug, very still. I should look. If I reach toward it, I drift.';

/** Discovering the body: paced with silences. */
export const BODY_LINES: string[] = [
  'Someone is lying here.',
  'So still. As if asleep.',
  'That coat. Those hands. The ink stain on the left cuff, the one that never washed out...',
  '...',
  '...it\u2019s me.',
  'That is my body. I am looking down at my own body.',
  'My name... my name is Alistair Finch. I make clocks.',
  'I made clocks.',
  'No wound. Nothing broken. Just... asleep, and never waking.',
  'My evening tea. It tasted bitter tonight. I remember thinking so.',
  'Someone put something in my tea.',
  'Someone in this house did this to me.',
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


/** The opportunity sheet that sets the prior. {total}, {top} and {absent} are filled in per case. */
const PRIOR_SOURCE = {
  id: 'log',
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
      'The sleeping draught was in this tea, so whoever handled the cup had a chance to slip it in. But Graves carries my tea every night: a cup passes through hands for innocent reasons too.',
    leadIn: 'My teacup is still on the desk. Let me start there.',
    title: 'Fingerprints on the Teacup',
    found: 'On the study desk, beside the clock I was mending.',
    evidence: { kind: 'facts', rows: [
      ['Object', 'Blue willow teacup'],
      ['Contents', 'Cold tea, a brown ring at the bottom'],
      ['Smell', 'Faint and bitter'],
      ['Fingerprints', 'On the handle and the rim'],
      ['Prints match', 'Graves (right thumb, small scar across it)'],
    ] },
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
      'Dated three days ago, the day we quarrelled about my will, and never sent. It shows strong feelings, maybe even a motive. But strong feelings are common, and poisoning is rare.',
    leadIn: 'Clara\u2019s room is upstairs. If she has been writing to me, the drafts will be in her writing desk.',
    title: 'An Angry Letter',
    found: 'Folded small at the back of Clara\u2019s writing-desk drawer. A draft, crossed out and rewritten.',
    evidence: { kind: 'letter', date: 'Tuesday', lines: ['Uncle \u2014', 'If you change your will, I will NEVER forgive you!'], sign: 'C.' },
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
      'The likelihood ratio is only 2: it only doubles Clara’s odds. By the ghost’s estimates she would now be at {niece}. That is not a confession.',
    reaction: [
      'Clara. She was so angry with me...',
      'Anger makes a vivid story. But a vivid story isn\u2019t the same as a likely one.',
    ],
  },
  {
    id: 'boot',
    short: 'a muddy print hidden behind the fern',
    context:
      'Someone came in through the garden tonight, by a window that is never left open. Who would be likely to leave a print like this?',
    leadIn: 'A cold draft... it comes from the conservatory, at the far end of the house.',
    title: 'A Muddy Boot Print',
    found: 'On the conservatory floor, hidden behind the big fern, right under the window.',
    evidence: { kind: 'facts', rows: [
      ['Mark', 'One boot print, in wet garden mud'],
      ['Size', 'Large, with a worn heel'],
      ['Pointing', 'Into the house'],
      ['Window above', 'Unlatched'],
      ['Mud', 'Still soft'],
    ] },
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
      'By the ghost’s estimates: Pip {gardener}, Voss {partner}. The clue points to the GARDEN, not one person.',
    trapEasy: 'A large likelihood ratio flips the lead',
    lessonEasy:
      'Clara\u2019s room is upstairs, while Voss parks by the garden gate. Mud is 5\u00D7 more likely if Voss did it, ' +
      'so this one clue can flip the lead: by the ghost’s estimates Voss would now be at {partner}. A large likelihood ratio moves belief a lot.',
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
      'I have never heard of Harrow & Pike. If someone was stealing from the business and feared I was about to go through the books, that would be a reason to silence me.',
    leadIn: 'Voss kept the partnership books in his desk, in the office.',
    title: 'The Partnership Ledger',
    found: 'In the bottom drawer of Voss\u2019s desk, under a stack of blank invoices.',
    evidence: { kind: 'table', columns: ['Date', 'Paid to', 'Amount'], rows: [
      ['3 March', 'Harrow & Pike Ltd', '\u00A3340'],
      ['11 April', 'Harrow & Pike Ltd', '\u00A3415'],
      ['2 June', 'Harrow & Pike Ltd', '\u00A3520'],
      ['19 August', 'Harrow & Pike Ltd', '\u00A3610'],
      ['7 October', 'Harrow & Pike Ltd', '\u00A3280'],
    ], foot: 'Total this year: \u00A32,165.  Every entry in the same tidy hand: E. Voss.' },
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
      'By the ghost’s estimates Voss would now be at {partner}. Notice that it took a strong likelihood ratio, not a vivid story.',
    reaction: [
      'Voss. My partner. Stealing from me?',
      'This clue fits one person far better than anyone else. That is what strong evidence feels like.',
    ],
  },
  {
    id: 'phone',
    short: 'this telephone log',
    context:
      'Graves left my tea on the desk at half past nine, and I drank it a little before ten. The draught went in some time around 9:40. Anyone on the telephone then could hardly have been in my study.',
    leadIn: 'The switchboard log lives in the telephone table drawer, back in the hallway.',
    title: 'The Telephone Log',
    found: 'In the hallway telephone table drawer: the switchboard operator\u2019s log.',
    evidence: { kind: 'table', columns: ['Time', 'Caller', 'Called', 'Length'], rows: [
      ['4:12 pm', 'Mr A. Finch', 'Hollis Brass Co.', '6 min'],
      ['7:48 pm', '(incoming)', 'for Mr E. Voss', '2 min'],
      ['9:35 pm', 'Miss C. Finch', 'Edinburgh 4471', '15 min'],
    ] },
    likelihoods: [0.5, 0.05, 0.5, 0.5],
    reasons: [
      'If Graves did it, Clara\u2019s evening call has nothing to do with it. She phones friends most evenings: about even odds, 0.5.',
      'If Clara poured the draught at about 9:40, she could hardly be on a call from 9:35 to 9:50. Only a faked log would explain it: 0.05.',
      'If Voss did it, Clara\u2019s call is unrelated. She phones friends most evenings: about even odds, 0.5.',
      'If Pip did it, Clara\u2019s call is unrelated. She phones friends most evenings: about even odds, 0.5.',
    ],
    trap: 'Exculpatory evidence',
    lesson:
      'Evidence can clear people too. An alibi makes the clue 10× LESS likely under "Clara did it". ' +
      'By the ghost’s estimates she would fall to {niece}, and the others share what she loses.',
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
    leadIn: 'Pip keeps his greenhouse log in the potting cupboard, in the conservatory.',
    title: 'The Greenhouse Log',
    found: 'On the top shelf of the potting cupboard: Pip\u2019s greenhouse notebook.',
    evidence: { kind: 'table', columns: ['Time', 'Temp.', 'Time', 'Temp.'], rows: [
      ['9:00 pm', '61\u00B0F', '9:40 pm', '59\u00B0F'],
      ['9:10 pm', '61\u00B0F', '9:50 pm', '59\u00B0F'],
      ['9:20 pm', '60\u00B0F', '10:00 pm', '58\u00B0F'],
      ['9:30 pm', '60\u00B0F', '', ''],
    ], foot: 'Small, careful pencil. No gaps.  \u2014 P.' },
    likelihoods: [0.6, 0.6, 0.6, 0.09],
    reasons: [
      'If Graves did it, Pip simply did what he does most evenings: an unbroken log is likely, 0.6.',
      'If Clara did it, Pip simply did what he does most evenings: an unbroken log is likely, 0.6.',
      'If Voss did it, Pip simply did what he does most evenings: an unbroken log is likely, 0.6.',
      'If Pip did it, he would have to leave the greenhouse and still keep an unbroken record every ten minutes. Possible, if he faked it: 0.09.',
    ],
    trap: 'Exculpatory evidence (weighing against the earlier clue)',
    lesson:
      'Remember the boot print that pointed at Pip? This alibi cancels most of it. ' +
      'Bayesian updating lets evidence add up AND cancel out. By the ghost’s estimates Pip would drop to {gardener}.',
    reaction: [
      'Dear Pip, counting temperatures while I fell asleep for good.',
      'The mud pointed at him; this points away. Evidence can cancel out evidence.',
    ],
  },
  {
    id: 'cufflink',
    short: 'a \u201CV\u201D cufflink under my chair',
    context:
      'Voss wore a pair just like this today, at our meeting and at supper. But he also sat at this very desk this afternoon, hours before anything happened.',
    leadIn: 'My desk chair in the study has been pushed back. Was something underneath it?',
    title: 'A Cufflink Engraved "V"',
    found: 'Under my desk chair, caught in the fringe of the rug.',
    evidence: { kind: 'facts', rows: [
      ['Object', 'One silver cufflink'],
      ['Engraving', 'A looping \u201CV\u201D'],
      ['Its partner', 'Missing'],
    ] },
    likelihoods: [0.3, 0.3, 0.6, 0.3],
    reasons: [
      'If Graves did it, Voss could still have lost it at our meeting or at supper: 0.3.',
      'If Clara did it, Voss could still have lost it at our meeting or at supper: 0.3.',
      'If Voss came back tonight, a dropped cufflink is more likely: 0.6.',
      'If Pip did it, Voss could still have lost it at our meeting or at supper: 0.3.',
    ],
    trap: "Prosecutor's fallacy",
    lesson:
      'P(cufflink | Voss guilty) = 0.6, but that is NOT P(Voss guilty | cufflink). ' +
      'On its own this clue is weak (likelihood ratio 2). What convicts Voss is ALL the evidence together: by the ghost’s estimates, {partner}.',
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

/** Every suspect in the story (in log order), including those a difficulty leaves out. */
export const allSuspects = () => ALL_SUSPECTS;

/** Fill a lesson template's {suspect} placeholders from any distribution over the active suspects. */
export function fillLesson(template: string, dist: number[]): string {
  return template.replace(/\{(butler|niece|partner|gardener)\}/g, (_m, id: string) => {
    const k = SUSPECTS.findIndex((s) => s.id === id);
    return k < 0 ? '' : fmtPct(dist[k]);
  });
}

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
      title: src.title,
      found: src.found,
      evidence: src.evidence,
      context: src.context,
      short: src.short,
      likelihoods,
      reasons: idx.map((i) => src.reasons[i]),
      trap: (easy && src.trapEasy) || src.trap,
      lesson: fill((easy && src.lessonEasy) || src.lesson, belief),
      lessonTemplate: (easy && src.lessonEasy) || src.lesson,
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
