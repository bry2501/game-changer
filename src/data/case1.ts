/**
 * "The Clockmaker's Last Hour": the whole game's story and probability model, as data.
 * One night, one hour, two suspects (Clara and Thomas), seven clues.
 * The screenplay (npm run screenplay) is generated from this file.
 */

export interface Suspect {
  id: string;
  name: string;
  role: string;
  color: number;
  /** Hours spent inside the house between 6 pm and 10 pm: the basis of the prior. */
  hoursInside: number;
  /** What the ghost remembers about them when memory returns. */
  memory: string;
  /** Who they are to John, and what they might have to gain or lose. */
  backstory: string;
  /** What they did tonight (consistent with the household log), if the memory recalls it. */
  tonight?: string;
  /** The household log entry. Must span hoursInside within 6–10 pm. */
  logIn: string;
  logOut: string;
  pronoun: 'he' | 'she';
  /**
   * Voices from the memory, heard after the backstory. `cue` is a stage direction (screenplay only);
   * lines are [speaker, words], with *asterisks* marking spoken emphasis.
   */
  voices?: { cue: string; lines: [string, string][]; after?: string };
}

/**
 * The evidence itself, exactly as found, with no interpretation:
 * - letter: a handwritten note
 * - table: a log or ledger (rows of columns)
 * - facts: plain observations of a physical object
 * - will: a will, drawn as the document (title, numbered clauses, an empty signature line, a pencilled margin note)
 * - receipt: a shop receipt, drawn as the slip itself (leave customer '' for a blank name line)
 * - sketch: a pencil drawing of an object, with pencilled notes pointing at it. The notes go, in order,
 *   to: boot (the latch, the heel, the mud, the toe); foxglove (the stripped stem, the cut stubs, the
 *   other pots); knife (the handle, the initials, the blade). Extra notes are written underneath.
 */
export type Evidence =
  | { kind: 'letter'; date: string; lines: string[]; sign: string }
  | { kind: 'table'; columns: string[]; rows: string[][]; foot?: string; widths?: number[] }
  | { kind: 'facts'; rows: [string, string][] }
  | { kind: 'sketch'; drawing: 'boot' | 'foxglove' | 'knife'; notes: string[] }
  | { kind: 'will'; title: string; of: string; opening: string; clauses: string[]; signing: string; margin?: string }
  | {
      kind: 'receipt';
      shop: string;
      trade: string;
      when: string;
      items: [string, string][];
      total: string;
      customer: string;
      foot?: string;
    };

export interface Clue {
  id: string;
  title: string;
  /** The evidence itself, as found. */
  evidence: Evidence;
  /** A memory the clue shakes loose, shown (in amber) before the ghost's reading. */
  memory?: string;
  /** Stage direction for the memory (screenplay only). */
  memoryCue?: string;
  /** The ghost's reading of it, one thought at a time, before any analysis. */
  context: string[];
  /** Short name used in questions: "How likely would I be to find ___?" */
  short: string;
  /** The clue in a few words, for the math page: "the letter". */
  noun: string;
  /** The intended ratings as likelihoods, P(this clue | suspect i is the murderer): a model answer, never shown. */
  likelihoods: number[];
  /** The ghost's thought about each suspect's story (shown on the rating page). */
  hints: string[];
  /** Name of the reasoning trap this clue is built around. */
  trap: string;
  /** What the clue teaches (the recap page). */
  lesson: string;
  /** The ghost's inner voice right after the clue. */
  reaction: string[];
  /** The ghost's thought pointing toward the next clue (or back to the body). */
  nextThought: string;
  /** How the hiding place gives way (screenplay only). */
  searchCue: string;
}

export const CASE_TITLE = "The Clockmaker's Last Hour";

/** Title screen copy. */
export const TITLE_TAGLINE = 'One night. One hour. Two suspects. You are the ghost, and you have until the clocks strike eleven.';
export const HOW_IT_WORKS =
  'Search the house for clues, and rate each one from 1 to 5 to say how well it fits each suspect’s story. Watch suspicion shift. ' +
  'There are no formulas to learn along the way; the numbers behind it are waiting at the end if you want them.';

export const SUSPECTS: Suspect[] = [
  {
    id: 'niece', name: 'Clara', role: 'the niece', color: 0xff9fc6, hoursInside: 3,
    memory: 'My brother’s daughter. Bright, stubborn, and the closest thing I have to family.',
    backstory:
      'Her parents died when she was twelve, and she grew up in this house, all elbows and questions. At nine she took apart my pocket watch and put it back together, and it ran. ' +
      'Now she studies law in the city and argues like a barrister, which is a polite way of saying she argues like me. ' +
      'She is the only one who noticed that I have stopped sleeping properly, and she has nagged me about it since the spring. ' +
      'This week I told her I meant to leave the house to the Clockmakers’ Club instead of to her. We both said things we regret.',
    logIn: '7:00 pm', logOut: '10:00 pm', pronoun: 'she',
  },
  {
    id: 'gardener', name: 'Mr. Thomas', role: 'the gardener', color: 0xffd27a, hoursInside: 2,
    memory: 'Edmund Thomas, my gardener. He smiles a little too much.',
    backstory:
      'Thomas has been my gardener for twenty years. He keeps the garden and the grounds, and lives in the cottage at the end of them. ' +
      'Last week I told him the Club would likely sell the grounds once I sign my will on Monday, and that the cottage would go with them.',
    tonight: 'He came at four to go over the repairs to the glass and left his bicycle, as he always does, by the garden gate. He stayed to supper and signed out at eight.',
    logIn: '4:00 pm', logOut: '8:00 pm', pronoun: 'he',
  },
];

/** The whole household log: the suspects, and the two who were not in tonight. [name, signed in, signed out] */
export const LOG_ROWS: string[][] = [
  ['Poe', '—', '—'],
  ['Clara', '7:00 pm', '10:00 pm'],
  ['Mr. Thomas', '4:00 pm', '8:00 pm'],
  ['Edgar', '—', '—'],
];

export const CULPRIT_INDEX = 1;

// ---------------------------------------------------------------- the opening

/** Thrown into ghostly existence: no memory, no context. */
export const AWAKEN_LINES: string[] = [
  '...',
  'It’s dark.',
  'And cold. Too cold...',
  'I don’t remember getting here.',
  'My name feels out of reach.',
];

/** Beat: drifting to the grandfather clock and reaching for it. */
export const CLOCK_LINES: string[] = ['A grandfather clock?', 'Did I... build this?'];
export const CLOCK_AFTER: string[] = ['I went right through it...', 'As if it were real, and I were not.'];

/** Beat: the window that shows no reflection. */
export const WINDOW_LINES: string[] = [
  'The window...',
  'I should see my face reflected in the glass.',
  'But I see nothing. Only the room behind me and the moon.',
  'What... am I?',
];

/** Shown once the player can move again. */
export const DRIFT_HINT: string[] = ['I see something lying on the rug. Very still.', 'I cannot tell what it is from here.'];

/** Discovering the body: paced with silences. */
export const BODY_LINES: string[] = [
  'A person is lying there.',
  'So still.',
  'That coat. Those hands. It all feels so familiar.',
  '...',
  '...it’s me!',
  'That is my body. I am standing over my own body.',
  'My name... was John Bayes.',
  'What happened to me?',
  'I see no bullet wounds. No knife. No broken bones.',
  'I remember drinking my evening tea...',
  'It tasted bitter tonight. I remember drinking it anyway.',
  'Someone must have put something in my tea.','But who?',
];

/** After the flash: the memory starts to surface. */
export const BODY_AFTER: string[] = [
  'I am remembering something...',
];

export const MEMORY_INTRO = 'There were two of them...';

export const MEMORY_OUTRO = [
  'Everything is still a fog.',
  'But memories seem to come back when I stand close to things.',
  'One of them did this. Already my gut whispers a name...',
  'But a gut feeling is how the living get things wrong. I am no longer living. Perhaps I can do better.',
  'I will gather evidence, and weigh each clue honestly.',
];

export const AFTER_MEMORY_THOUGHTS: string[] = [
  'Where to begin...',
  'Everyone who comes and goes signs the household log. It should be on the side table.',
];

// ---------------------------------------------------------------- the prior

const TOTAL_HOURS = SUSPECTS.reduce((a, s) => a + s.hoursInside, 0);

/** The household log, which sets the prior. */
export const PRIOR_SHEET = {
  id: 'log',
  title: 'The Household Log',
  total: TOTAL_HOURS,
  text:
    'This was my own rule: everyone signs the household log when they come and go. A house should know who is in it. ' +
    'This shows who was inside tonight between 6 pm and 10 pm, and for how long. I remember Poe had asked for the evening off to visit his sister. ' +
    'Edgar went home at six, as he always does. That leaves two people who were in this house with my tea: Clara and Mr. Thomas. The question is, who did it?',
  context:
    'I need a starting point. If I had no information to go on, I would give each suspect an equal 50/50 chance of guilt. ' +
    'But I can use this log to count the hours each of them spent under this roof: the longer someone was here, the more chances they had. ' +
    'That starting belief is called the PRIOR.',
  /** The Start page: where suspicion begins. */
  lesson:
    'Each person’s time in the house becomes their prior suspicion: whoever spent the most time has the highest probability. That’s my starting point.',
  /** The Choose page: the player picks the starting point they will carry forward. */
  choose: {
    title: 'Choose my prior',
    intro: 'Which starting point should I carry forward? Either one is a fair start. The clues will move whichever I pick.',
    options: [
      { name: 'A clean slate', text: 'Ignore the log. With nothing to go on, both are equally likely.' },
      { name: 'The hours', text: 'Trust the log. The longer someone was here, the more chances they had. Leans towards Clara.' },
    ],
    hint: 'Press 1 or 2, or click a card.',
  },
  /** First thought after the log, whichever prior was chosen. */
  remember: 'I have to remember the prior moving forward.',
  /** After choosing the hours. */
  reaction: [
    'Clara was here the longest, so she starts as the likeliest culprit.',
    'Every new piece of evidence I find will shift this suspicion.',
  ],
  /** After choosing the clean slate. */
  reactionEven: [
    'I start them level: neither one is likelier than the other.',
    'Every new piece of evidence I find will shift this suspicion.',
  ],
  nextThought: '',
};

// ---------------------------------------------------------------- the clues

type ClueSource = Omit<Clue, 'nextThought'> & { leadIn: string };

const CLUE_SOURCES: ClueSource[] = [
  {
    id: 'letter',
    title: 'An Unfinished Letter',
    leadIn: 'Clara’s room is upstairs. I know my niece. If she wrote something, it will be in her writing desk.',
    searchCue: 'The drawer sticks, then slides out with a small wooden cry',
    evidence: { kind: 'letter', date: 'Tuesday', lines: ['Uncle —', 'If you change your will, I will NEVER forgive you!'], sign: 'C.' },
    context: [
      'Three days ago: the day we quarrelled about my will. But the letter was never finished and sent to me.',
      'It shows strong feelings, maybe even a motive. But the question is not whether anger leads to murder. It is whether this letter fits one story better than the other.',
    ],
    short: 'an angry letter like this',
    noun: 'the letter',
    likelihoods: [0.7, 0.5],
    hints: [
      'If Clara is the murderer, the quarrel over my will would be her likely motive. But Clara writes like this all the time and has never hurt a soul. So that makes this letter more expected, but not by a huge margin.',
      'If Thomas is the murderer, nothing about this event changes. Clara and I still quarrelled, and she still went upstairs and wrote this angry letter. His guilt does not prevent this letter from existing, it only makes it less expected here than in her story.',
    ],
    trap: 'Vivid but weak evidence',
    lesson:
      'An angry letter feels like a confession. But people write angry letters all the time and hurt no one. A clue only shifts suspicion as much as it fits one story better than the others. ' +
      'Notice how little the board moved: if your two ratings were far apart, it swung much further than a never-sent draft deserves.',
    reaction: ['Clara. She was so angry with me...', 'Anger makes a vivid story. But a vivid story isn’t the same as a likely one.'],
  },
  {
    id: 'will',
    title: 'The Will',
    leadIn: 'Clara’s letter was about my will. Let me see what I actually wrote. The draft should be in my desk downstairs.',
    searchCue: 'Beneath the pencils and the coiled mainsprings lies a page folded in three',
    evidence: {
      kind: 'will',
      title: 'Last Will and Testament',
      of: 'of John Bayes, Clockmaker',
      opening: 'I, John Bayes, being of sound mind, leave what I own as follows:',
      clauses: [
        'My house, and all that is in it save what follows, to the Clockmakers’ Club.',
        'To my niece, Clara, the grandfather clock and my watch.',
        'To Edmund Thomas, my gardener, six months’ notice to leave the cottage.',
      ],
      signing: 'To be signed Monday, 10 a.m., before Mr. Penrose, solicitor.',
      margin: 'C. — think first. Talk to her.',
    },
    context: [
      'My will. The house was to be given to the Club, a clock and a watch for Clara, and six months’ notice for Thomas. No wonder Clara was angry. And Thomas, though he didn’t show it.',
      'It’s unsigned.',
      'But is this news? I knew all of this before I opened the drawer.',
    ],
    short: 'a Will like this in my desk',
    noun: 'the Will',
    likelihoods: [0.9, 0.9],
    hints: [
      'In a world where Clara is the murderer, my will would still exist. So finding a draft in my own desk is very likely.',
      'In a world where Thomas is the murderer, my will would also still exist. So finding a draft in my own desk is just as likely as it was in Clara’s story.',
    ],
    trap: 'Old news doesn’t count much',
    lesson:
      'What has to be true for this draft to be in the drawer? I must have written it before I was poisoned. So nobody’s guilt can reach back and change it. It will be in the drawer in every outcome. ' +
      'A will in my desk might feel like a motive for Clara and Thomas. But I knew about the will before I opened the drawer. ' +
      'So it changes nothing.',
    reaction: [
      'Nothing moved. That feels wrong, but it isn’t: I knew about the will before I opened the drawer.',
    ],
  },
  {
    id: 'boot',
    title: 'A Muddy Boot Print',
    leadIn: 'There’s cold air moving through the house. It smells of wet earth, and it’s coming from the conservatory.',
    searchCue: 'The fronds part and settle again',
    evidence: {
      kind: 'sketch',
      drawing: 'boot',
      notes: ['window above: unlatched', 'large boot, worn heel', 'garden mud, still soft', 'toe points into the house'],
    },
    context: [
      'One boot print. Wet garden mud, the heel worn down on one side.',
      'It points into the house, so whoever left it was coming in. Edgar mops this floor every evening before he goes home at six, so this print is from tonight. And the mud is still soft.',
      'The window above it is unlatched. I latch that window myself every autumn. Someone came in through the garden tonight. Who would be likely to leave a print like this?',
    ],
    short: 'a muddy print hidden behind the fern',
    noun: 'the boot print',
    likelihoods: [0.1, 0.5],
    hints: [
      'If Clara poisoned my tea, why would she come in through the conservatory? She has been inside since 7pm, and the front door has always been open to her. And this print is large and fresh. A print like this is very hard to explain in her story.',
      'If Thomas poisoned my tea: He signed out at eight, so to poison the tea he had to get back in unseen. A muddy print under this window is exactly what he would leave. But it isn’t guaranteed, because he might have come in another way and left no print.',
    ],
    trap: 'One lopsided clue can swing the board',
    lesson:
      'The print doesn’t prove Thomas did it. But it does mean Clara’s story needs for it to be a coincidence and his doesn’t. When a clue fits one story far better than another, a single clue can swing the whole board.',
    reaction: [
      'Garden mud, under the open window. Who walks through a garden at night?',
      'Clara has been inside since seven, and this print is large. But Thomas leaves his bicycle by the garden gate, and he knows every path in that garden.',
    ],
  },
  {
    id: 'foxgloves',
    title: 'The Foxglove Plants',
    leadIn: 'My tea tasted bitter. Foxglove plants are bitter too, and they can kill. Thomas keeps them in pots on the potting bench.',
    searchCue: 'A row of foxglove plants stands in pots along the bench, their long leaves soft in the moonlight',
    evidence: {
      kind: 'sketch',
      drawing: 'foxglove',
      notes: ['one pot stripped of its lower leaves', 'cut clean, close to the stem', 'the other pots untouched'],
    },
    context: [
      'Foxglove plant. Beautiful, and deadly. I never liked having them in the house.',
      'One pot has been stripped of its lower leaves, cut clean, close to the stem. The other pots are untouched.',
      'Foxglove plant leaves, steeped in tea, would taste bitter. They could also stop a man’s heart. Or it may be nothing: Thomas is always trimming something. That is the question.',
    ],
    short: 'a foxglove plant stripped like this',
    noun: 'the stripped foxglove plant',
    likelihoods: [0.3, 0.9],
    hints: [
      'If Clara is the murderer, the foxglove plants have nothing to do with her. She has never so much as watered them. Then a stripped pot would only be Thomas’s ordinary pruning. Unlikely, though not impossible.',
      'If Thomas is the murderer, here is his poison, grown by his own hand: the foxglove plants he has tended for years, which he knows better than anyone alive. In his story, a stripped pot like this is exactly what I’d expect to find.',
    ],
    trap: 'Means evidence (diagnostic, not decisive)',
    lesson: 'This clue fits one person far better than anyone else. That is what strong evidence looks like: not loud, just lopsided.',
    reaction: [
      'Thomas. Twenty years in my garden. Could it be him?',
      'This clue fits one person far better than the other. That’s what strong evidence looks like.',
      'Careful, John. I rated how likely a stripped foxglove plant would be *if Thomas is the murderer*. That isn’t the same as how likely it is that Thomas is the murderer. ' +
        'The first is a rating; the second is the board, which also depends on where I started and on how well the foxglove plants fit Clara’s story. ' +
        'Mixing the two up is called the prosecutor’s fallacy, and it has sent real people to prison.',
      'Everything is pointing at Edmund. That is exactly when I should be most careful. I haven’t looked for anything that would count against him.',
    ],
  },
  {
    id: 'slip',
    title: 'The Pharmacy Receipt',
    leadIn: 'Clara walked at seven, in her grey coat. It should be on the hall stand.',
    searchCue: 'Clara’s grey walking coat hangs among the others; the receipt in its pocket stirs as the ghost’s hand passes through',
    evidence: {
      kind: 'receipt',
      shop: 'HARTLEY & SON',
      trade: 'Pharmacy',
      when: 'Friday   6:40 pm',
      items: [['Sleeping pills, 1 oz', '2s 6d']],
      total: '2s 6d',
      customer: '',
      foot: 'Thank you',
    },
    context: [
      'Hartley’s, the pharmacy on the corner. 6:40 on Friday evening, twenty minutes before she came home.',
      'Sleeping pills. Poe fetches mine, on the first of the month, and I never asked Clara to fetch them. She has never needed any. Clara sleeps like a baby.',
      'Tonight I fell asleep and didn’t wake. The tea was bitter, and so are sleeping pills. I can’t tell whether it was the pills or foxglove plant leaves, so I have to weigh both.',
      'I’ve been so busy suspecting Thomas. Now I have a clue I didn’t expect.',
    ],
    short: 'a Pharmacy Receipt like this in Clara’s coat',
    noun: 'the Pharmacy Receipt',
    likelihoods: [0.7, 0.3],
    hints: [
      'If Clara poisoned me, she needed something to put me to sleep, and sleeping pills are exactly that. She bought them at 6:40, during her walk. Keeping the slip in her coat pocket is plausible, since people forget what’s in a pocket, but a careful poisoner might have thrown it away. So fairly likely.',
      'If Thomas poisoned the tea. Then Clara bought sleeping drops this evening for some other reason. I never asked her to fetch his, so this is a timing coincidence. Unlikely, though not impossible.',
    ],
    trap: 'Evidence against your favourite',
    lesson:
      'Evidence doesn’t care whom you suspect. It fits one story better, and you have to say which, even when you’d stopped looking. The evidence was running toward Thomas, but this clue pushes the other way.',
    reaction: [
      'The board has swung back. Clara is a real suspect again, and I’m ashamed of how little I wanted that.',
    ],
  },
  {
    id: 'phone',
    title: 'The Telephone Log',
    leadIn: 'It all comes down to half past nine. The exchange writes down every call made from this house. That log is in the telephone table drawer, in the hallway.',
    searchCue: 'The drawer slides out',
    evidence: {
      kind: 'table',
      columns: ['Time', 'Caller', 'Called', 'Length'],
      rows: [
        ['4:12 pm', 'Mr J. Bayes', 'Hollis Brass Co.', '6 min'],
        ['7:48 pm', '(incoming)', 'for Mr E. Thomas', '2 min'],
        ['9:28 pm', 'Miss C. Bayes', 'Edinburgh 4471', '29 min'],
      ],
    },
    memoryCue: 'MEMORY. A flicker: a cup set down on a blotter, the saucer chiming against the wood. Somewhere in the house, a clock strikes the half hour.',
    memory:
      'I’m remembering something. Half past nine. I carried my tea to the desk myself and set it down beside the blotter. A little before ten I drank it. Whoever put something in it did so in that half hour, while the cup stood there.',
    context: [
      'Now the log. The first line is mine: brass, for the Hollis order. Nothing there. But Clara rings Edinburgh at 9:28 and stays on the line for twenty-nine minutes. Anyone on the phone for all of that time could hardly have been in my study.',
      'And here, at 7:48, a call for Thomas. Two minutes. Twelve minutes later he signed out. I can’t tell what that means. It fits either story equally well, so it stays off the scale. A clue I can’t weigh is one I mustn’t pretend to weigh.',
    ],
    short: 'this telephone log',
    noun: 'the telephone log',
    likelihoods: [0.1, 0.5],
    hints: [
      'If Clara put something in my tea, she had to stand at my desk some time between half past nine and ten. The log has her on the line to Edinburgh for that whole half hour. Her guilt and this log hardly fit together. Either the exchange got twenty-nine minutes wrong, or she left the receiver on the table and slipped away. Both could happen. Neither is likely.',
      'If Thomas is the murderer, Clara’s call is just Clara phoning someone from the hallway. A call this long, at this hour, isn’t guaranteed, but his guilt changes nothing about whether she made it. It neither helps nor hurts his story much.',
    ],
    trap: 'Exculpatory evidence',
    lesson:
      'Evidence can clear people too. If Clara was on the telephone the whole time the tea sat on the desk, the clue hardly fits her story, so her share shrinks and the other suspect’s grows. ' +
      'An alibi is rarely perfect (a log records a call, not who held the receiver), so her share shrinks a great deal but never to nothing.',
    reaction: [
      'Clara was on the telephone the whole time my tea sat on the desk. Twenty-nine minutes.',
      'I’m relieved. I had begun to dread that it was her. An alibi is evidence too: it moves belief off one person, and it can only move it onto the other.',
    ],
  },
  {
    id: 'knife',
    title: 'A Pruning Knife',
    leadIn: 'Back to the study. My desk chair has been pushed back from the desk. Was something underneath it?',
    searchCue: 'Something small catches the moonlight in the fringe of the rug',
    evidence: {
      kind: 'sketch',
      drawing: 'knife',
      notes: ['folding pruning knife, bone handle', '“E.T.” scratched into the handle', 'blade closed'],
    },
    context: [
      'A pruning knife. Bone handle, with E.T. scratched into it. Thomas has carried one like it in his pocket for twenty years. He had it today, when he came to see me about the glass; I remember him cutting twine with it.',
      'But he also stood at this very desk this afternoon, hours before anything happened.',
    ],
    short: 'a pruning knife under my chair',
    noun: 'the pruning knife',
    likelihoods: [0.5, 0.7],
    hints: [
      'If Clara is the murderer, the knife is still easy to explain. Thomas stood at this desk this afternoon while we went over the repairs to the glass, and things fall out of pockets. It is as likely as not.',
      'If Thomas is the murderer, he stood in this room tonight as well as this afternoon, so he had two chances to lose it. His story explains it a little better, not overwhelmingly.',
    ],
    trap: 'A clue that fits both stories',
    lesson:
      'Thomas’s knife sounds like proof, but he stood at this desk this afternoon, so it would turn up in nearly any story. ' +
      'On its own it is a modest clue: when a clue would be found in both stories, it hardly moves the board, however much it feels like a smoking gun. ' +
      'A clue can be likely in a story and still prove little, if it would turn up almost anywhere. What decides a case is everything together.',
    reaction: [
      'Thomas’s knife. It looks like an accusation. But he stood at this desk this afternoon...',
      'On its own it proves little. Together with everything else, the picture is clear.',
      'The great clock in the hall is about to strike eleven.',
    ],
  },
];

export const FINAL_THOUGHT = 'I’ve seen enough. Time to return to my body and name the culprit.';

export const CLUES: Clue[] = CLUE_SOURCES.map(({ leadIn: _leadIn, ...c }, n) => ({
  ...c,
  nextThought: n + 1 < CLUE_SOURCES.length ? CLUE_SOURCES[n + 1].leadIn : FINAL_THOUGHT,
}));
PRIOR_SHEET.nextThought = CLUE_SOURCES[0].leadIn;

// ---------------------------------------------------------------- the accusation and the ending

/** What the ghost says at the accusation. {likely} and {other} follow the player's own board. */
export const ACCUSE_LINES = [
  'Back beside my body. It is time to name the culprit.',
  'Your board shows these beliefs. Who is the murderer?',
  'Look at the bars. Neither is empty. In most of the worlds that look like this one, it is {likely}. In a few, it is {other}.',
  'A bar is a belief, not a verdict. The living say it is better that ten guilty men go free than that one innocent man suffer. When the bars are close, I have to ask how bad it would be to accuse the wrong person, and not only who looks likelier.',
  'Choose carefully. A ghost only gets one accusation.',
];

/** One line of the ending: who speaks, and what. A `beat` is acted out before the line. */
export interface EndLine {
  who: 'ghost' | 'imagining' | 'clara' | 'direction';
  text: string;
  /** How a line is spoken (screenplay only), e.g. whispering. */
  how?: string;
  beat?: 'strike' | 'reconstruct' | 'eleven' | 'clara-enters' | 'silence' | 'rewind';
}

export const ENDING_CORRECT: EndLine[] = [
  { who: 'direction', beat: 'strike', text: 'The great clock begins to strike eleven. The music brightens.' },
  { who: 'ghost', text: 'Thomas. My gardener of twenty years.' },
  { who: 'ghost', text: 'I wasn’t there. This is only what the evidence leaves standing.' },
  {
    who: 'direction', beat: 'reconstruct',
    text: 'RECONSTRUCTION. The amber returns, but this isn’t memory: the ghost is piecing it together from what he found. Everything in this scene is imagined, and the ghost says so.',
  },
  { who: 'imagining', text: 'The garden and the cottage were all Edmund had. On Monday I would have signed them away.' },
  { who: 'imagining', text: 'Before he left at eight, he lifted the latch of the conservatory window. Then he signed my log, shook my hand, and waited in the dark garden.' },
  { who: 'imagining', text: 'At half past nine I set my cup on the desk and left the room for a few minutes. That part is still fog.' },
  { who: 'imagining', text: 'Boots in the wet earth. The window rising. A little brown bottle of foxglove plant, steeped strong. Then out the way he came, and his knife left in the fringe of the rug.' },
  { who: 'imagining', text: 'And Clara, in the hall, on the telephone to Edinburgh, with her back to all of it.' },
  { who: 'imagining', text: 'Who rang him at 7:48, I’ll never know. A case doesn’t have to explain every scrap.' },
  {
    who: 'direction', beat: 'eleven',
    text: 'The amber fades. In the hall the great clock has not finished striking. Eleven. A door opens at the back of the house, and light spills down the passage from the kitchen. Footsteps. The study door.',
  },
  {
    who: 'direction', beat: 'clara-enters',
    text: 'CLARA enters, in a grey cardigan, a small parcel in brown paper in her hand. She sees the body on the rug and stops. The parcel falls and does not break. She kneels.',
  },
  { who: 'clara', text: 'Uncle?' },
  { who: 'clara', text: '...Uncle.' },
  { who: 'ghost', text: 'Eleven o’clock. She always says goodnight.' },
  { who: 'ghost', text: 'The parcel has a card in her handwriting: *For sleeping. I’m sorry about the house. C.* The bottle from Hartley’s was a gift.' },
  { who: 'ghost', text: 'The clue that nearly condemned her was an olive branch. Unlikely doesn’t mean never.' },
  { who: 'clara', how: 'whispering', text: 'I don’t care about the house. I never did. I’m so sorry, Uncle.' },
  { who: 'ghost', text: 'It was never about the house, Clara. My note is in the margin of the will: *Talk to her.*' },
  { who: 'ghost', text: 'Tomorrow they’ll find the foxglove plant, the print and the knife. Tonight there’s only a girl on the floor of my study, talking to me as if I could hear.' },
  { who: 'ghost', text: 'Perhaps I can.' },
  { who: 'direction', beat: 'silence', text: 'The clocks fall silent one by one. The ghost rises and fades.' },
  { who: 'ghost', text: 'For the first time tonight, I can rest.' },
];

export const ENDING_WRONG: EndLine[] = [
  { who: 'ghost', text: '“{name}!” The accusation echoes through the empty house... and nothing happens.' },
  { who: 'ghost', text: 'Nothing happens, because it wasn’t her. I’ve accused an innocent girl, and the only one who heard was a ghost.' },
  { who: 'ghost', text: 'No. Wind it back. Wind it all back.' },
  {
    who: 'direction', beat: 'rewind',
    text: 'The great clock stops mid-stroke. Every clock in the house whirs backward at once, and the night rewinds like a watch. Ten o’clock.',
  },
  { who: 'ghost', text: 'Perhaps a loud clue drowned out the quiet ones?' },
];
