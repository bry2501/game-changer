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
  /** The ghost's reading of it, one thought at a time, before any analysis. */
  context: string[];
  /** A memory the clue shakes loose, shown (in amber) before the ghost's reading. */
  memory?: string;
  /** Short name used in questions: "How likely would I be to find ___?" */
  short: string;
  /** P(this clue | suspect i is the culprit). */
  likelihoods: number[];
  /** Plain-language reasoning for each likelihood (shown as hints; the only info in Hard mode). */
  reasons: string[];
  /** Name of the reasoning trap this clue is built around. */
  trap: string;
  /** What the clue teaches (no numbers: the player's own board is shown alongside). */
  lesson: string;
  /** The ghost's thought about each story, without a verdict (no number, no "likely"). */
  hints: string[];
  /** The ghost's inner voice right after the clue: first the gut, then the reflective voice. */
  reaction: string[];
  /** The ghost's thought pointing toward the next clue (or back to the body). */
  nextThought: string;
}

/** Authoring form of a clue. Lessons may contain {butler} {niece} {partner} {gardener},
 *  replaced by that suspect's true posterior after this clue in the active case. */
interface ClueSource extends Omit<Clue, 'nextThought' | 'hints'> {
  /** The ghost's thought that points toward THIS clue. */
  leadIn: string;
  /** Overrides for Easy, where only Clara and Voss are suspects. */
  /** Fuller reasoning for Level 1, keyed by suspect id: it points the way without giving the rating. */
  hintsSimple?: Record<string, string>;
  /** Plain-words lesson for Level 1. */
  lessonSimple?: string;
  trapEasy?: string;
  reactionEasy?: string[];
  /**
   * Text may use {other} ("the other" / "the others"), {stories} ("either story as well as the other" /
   * "every story about equally") and {tea} (who carried the tea: Graves, when he is in the house).
   */
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
    logIn: '6:00 pm', logOut: '9:30 pm', pronoun: 'he',
    absent: 'Graves had asked for the evening off to visit his sister; I remember saying yes.',
    absentLog: ['\u2014', 'not in tonight (evening off)'],
  },
  {
    id: 'niece', name: 'Clara', role: 'the niece', color: 0xff9fc6, hoursInside: 3,
    memory: 'My brother\u2019s girl. Bright, stubborn, and the closest thing I have to a daughter.',
    backstory:
      'Her parents died when she was twelve, and she grew up in this house, all elbows and questions. At nine she took apart my pocket watch and put it back together, and it ran. ' +
      'Now she studies law in the city and argues like a barrister, which is a polite way of saying she argues like me. ' +
      'This week I told her I meant to leave the house to the Clockmakers\u2019 Guild instead of to her. We both said things we regret.',
    tonight: 'She came back from a long walk at seven and went upstairs. After supper I did not see her again.',
    logIn: '7:00 pm', logOut: '10:00 pm (still in)', pronoun: 'she',
    voices: {
      cue: 'The memory sharpens into voices, an argument carried down a staircase.',
      lines: [
        ['Clara', 'To a *guild*, Uncle?'],
        ['Alistair', 'It\u2019s a house, Clara. It\u2019s bricks.'],
        ['Clara', 'It\u2019s the last place they were here.'],
      ],
    },
    absent: '',
    absentLog: ['', ''],
  },
  {
    id: 'partner', name: 'Mr. Voss', role: 'the business partner', color: 0xffd27a, hoursInside: 2,
    memory: 'Edmund Voss, my partner at Finch & Voss Clockworks. He smiles a little too much.',
    backstory:
      'We founded the business twenty years ago: my hands, his head for numbers. It made us both comfortable. ' +
      'But lately the accounts stopped making sense to me, and last week I told him I wanted to go through the books myself.',
    tonight: 'He came at four with papers to sign and parked, as he always does, by the garden gate. He stayed to supper and signed out at eight.',
    logIn: '4:00 pm (before the window)', logOut: '8:00 pm', pronoun: 'he',
    voices: {
      cue: 'A second voice, warm and unhurried.',
      lines: [['Voss', 'The books? Of course, Alistair. Whenever you like.']],
      after: 'He said it smiling. He says everything smiling.',
    },
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
    logIn: '6:00 pm', logOut: '7:30 pm (to the greenhouse)', pronoun: 'he',
    absent: 'Pip went home at six, as he always does.',
    absentLog: ['\u2014', 'out 6:00 pm (went home)'],
  },
];



/** Thrown into ghostly existence: no memory, no context. */
export const AWAKEN_LINES: string[] = [
  '...',
  'Dark.',
  'Cold. Not the cold that bites. The cold that settles, the way dust does.',
  'Ticking. Somewhere a clock is ticking. No... many clocks. Dozens. A whole congregation of them, keeping time over something.',
  'I don\u2019t remember arriving here.',
  'I don\u2019t remember anything at all. I reach for my own name the way you reach for the light switch in your own house, and my hand closes on nothing.',
];

/** Beat: drifting to the grandfather clock and reaching for it. */
export const CLOCK_LINES: string[] = [
  'A grandfather clock. I know this clock. I know the lean of it, a degree off plumb.',
  'That is not remembering. I remember nothing. That is my hands knowing something my head has lost.',
  'Did I... build it? These hands feel like hands that built things.',
  'Let me steady myself on it. I feel as though I might fall, which is absurd, because there is nothing left of me to fall.',
];
export const CLOCK_AFTER: string[] = [
  'My hand went straight through. Through the wood, the works, the swinging brass.',
  'As if the clock were the real thing, and I were the shadow it threw.',
];

/** Beat: the window that shows no reflection. */
export const WINDOW_LINES: string[] = [
  'The window. A silver garden, the hedges black as ink.',
  'There should be a face in this glass. Mine. Anyone\u2019s, looking back.',
  'There is nothing. Only the room behind me, and the moon. The glass is empty the way a room is empty when someone has only just left it.',
  'What... am I?',
];

/** Shown once the player can move again. */
export const DRIFT_HINT: string[] = [
  'Something is lying on the rug. Very still. I do not want to look at it. That is how I know I must.',
  'If I reach toward it, I drift.',
];

/** Discovering the body: paced with silences. Level 1 only (Graves is out tonight). */
export const BODY_LINES: string[] = [
  'Someone is lying here.',
  'So still. A man asleep in his coat, you would say, if you did not look at the hands.',
  'That coat. Those hands, the knuckles swollen from a lifetime of small springs. The ink stain on the left cuff, the one that never washed out.',
  'Margaret. The name comes up out of nowhere, and with it a kitchen, a bottle of vinegar, then salt, then her laughing and giving up and calling it my signature. My wife. A scrap of memory, small as a coin, and gone again.',
  '...',
  '...it\u2019s me.',
  'That is my body. I am standing over my own body, like a man who has come in out of the rain and found a stranger in his chair, and the stranger has his face.',
  'My name... my name is Alistair Finch. I make clocks.',
  'I made clocks.',
  'No wound. Not a mark on me. Nothing broken. Just... asleep, and never waking, like a clock that no one is going to wind.',
  'My evening tea. That comes back to me in a rush: Graves has the night off, so I made it myself. When, exactly, I cannot say; that part is still fog. ' +
    'It tasted bitter tonight. I remember thinking so. I remember thinking *the leaves are old*, and drinking it anyway.',
  'Not the leaves.',
  'Someone put something in my tea.',
  'Someone in this house did this to me.',
];

/** After the flash: the memory starts to surface. */
export const BODY_AFTER: string[] = [
  'Something is coming up through the floor of my mind.',
  'Faces. Voices. I am remembering something... let it come.',
];

/** Levels 2 and 3 return to the same night, with a wider net. */
export const REPRISE_LINES: Record<2 | 3, string[]> = {
  2: [
    'The clocks are turning backwards...',
    'My study again. The same night. My body on the rug.',
    'I named Voss, and the clocks did not stop. Perhaps I was right for the wrong reasons.',
    'I only remembered two faces. There was someone else here that night.',
  ],
  3: [
    'The clocks wind back once more.',
    'Right again, and still they tick. I am still leaving someone out.',
    'Graves. How could I forget Graves? He was in the house all evening.',
    'This time I weigh everyone, and I decide for myself where suspicion starts.',
  ],
};

/** The ghost, as the memory opens. {count} is the number of suspects, in words. */
const MEMORY_INTRO_SOURCE = 'I\u2019m remembering something. Who was here tonight. {Count} of them. Let me see their faces.';

export const MEMORY_OUTRO = [
  'That is all it will give me. Names, faces, the shape of an evening. Everything after supper is still fog.',
  'But memories seem to come back when I stand close to the things they belong to. I felt it with the stain on my cuff. If I find the right things, perhaps more will come.',
  'One of them did this.',
  'Already my gut whispers a name. I have spent my life distrusting any part that fits too easily.',
  'A gut feeling is how the living get things wrong. I am no longer living. Perhaps I can do better.',
  'I will gather what I can find, and weigh each piece honestly.',
];

export const AFTER_MEMORY_THOUGHTS: string[] = [
  'Where to begin...',
  'Even dead, I am a man who begins with the paperwork. Everyone who comes and goes signs the household log; I remember insisting on it. It should be on the side table.',
];


/** The opportunity sheet that sets the prior. {total}, {top} and {absent} are filled in per case. */
const PRIOR_SOURCE = {
  id: 'log',
  title: 'The Household Log',
  text:
    'My own rule, and I remember the day I made it: everyone signs the household log when they come and go, the vicar included. A house should know who is in it. ' +
    'It shows who was inside tonight between 6 pm and 10 pm, and for how long.{absent} ' +
    '{leaves} {count} people who were in this house with my tea: {names}. Everything I weigh from here on is a contest between those {count}. ' +
    'If I have overlooked a {nth}, none of it will be worth much.',
  context:
    'Before I weigh a single clue, I need somewhere to stand. I do not yet know when anyone could have reached my tea, so I will count the hours each of them spent under this roof: ' +
    'the longer someone was here, the more chances they had. That starting belief is called the PRIOR. It is a judgment, not a fact. ' +
    'And I will not rule anyone out completely: a belief set at zero can never be moved by any clue, however good.',
  lessonSimple:
    'Before any clue, suspicion starts where the opportunity was: whoever spent longest in the house starts highest. ' +
    'It is only a starting guess, not a verdict. Every clue from here will shift it.',
  lesson:
    'Prior = opportunity. Divide each person\u2019s hours inside by the total ({total} hours). ' +
    '{top} starts as the most likely suspect, but only because of the time spent in the house.',
  reaction: [
    '{top} was here the longest, so {pronoun} starts as the likeliest. That is opportunity, not guilt. The man nearest the door is not therefore the thief.',
    'Every clue from now on should shift these shares. By how much is the whole question.',
  ],
};

const ALL_CLUES: ClueSource[] = [
  {
    id: 'teacup',
    short: 'Graves\u2019s fingerprints on my teacup',
    context: [
      'The sleeping draught was in this tea, so whoever handled the cup had a chance to slip it in.',
      'But Graves carries my tea every night: a cup passes through hands for innocent reasons too.',
    ],
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
      'Graves serves my tea every night, and he carried this cup tonight as always: very likely.',
      'If Clara did it, Graves still brought the tea: his prints are still very likely.',
      'If Voss did it, Graves still brought the tea: his prints are still very likely.',
      'If Pip did it, Graves still brought the tea: his prints are still very likely.',
    ],
    trap: 'Non-diagnostic evidence',
    lesson:
      'It FEELS damning, but Graves handles that cup every night, so his prints are almost as likely whoever did it. A clue that fits every story about equally well barely moves the board, however dramatic it looks.',
    reaction: [
      'Graves\u2019s prints! It must be Graves.',
      '...But he carries that cup every single night. Of course his prints are on it.',
    ],
  },
  {
    id: 'letter',
    hintsSimple: {
      niece: 'If Clara did it, the quarrel over my will would be her reason, and a furious letter is exactly the footprint that kind of anger leaves. But Clara writes furious letters the way other people hum, and has never hurt a soul. So her guilt makes this letter more expected, though not by a huge margin.',
      partner: 'If Voss did it, nothing about that Tuesday changes. Clara and I still quarrelled, she still went upstairs and wrote the most savage thing she could think of, and she still thought better of sending it. His guilt does not stop this letter existing, so it is only a little less expected here than in her story.',
    },
    short: 'an angry letter like this',
    context: [
      'Tuesday. Three days ago: the day we quarrelled about my will. A letter in a drawer is a letter nobody read.',
      'Look at the pressure on that last line. The nib went right through the paper. Read it cold and you would see her standing over my bed.',
      'It shows strong feelings, maybe even a motive. But someone really was poisoned tonight, so the question is not whether anger leads to murder. It is whether this letter fits one story better than {other}.',
    ],
    leadIn:
      'Clara\u2019s room is upstairs. I know my niece. When she is angry, Clara writes. She always has: pages of it, scorching, and then she never sends them. If she wrote to me after our quarrel, the draft will be in her writing desk.',
    title: 'An Angry Letter',
    found: 'Folded small, then smaller, at the back of Clara\u2019s writing-desk drawer. A draft, crossed out and rewritten, the nib pressed so hard on the last line that it nearly tore the paper.',
    evidence: { kind: 'letter', date: 'Tuesday', lines: ['Uncle \u2014', 'If you change your will, I will NEVER forgive you!'], sign: 'C.' },
    likelihoods: [0.5, 0.7, 0.5, 0.5],
    reasons: [
      'If Graves did it, nothing about that Tuesday changes: Clara still quarrelled with me, wrote this, and never sent it: as likely as not, 0.5.',
      'If Clara did it, the quarrel over my will would be her reason, and this letter is that anger on paper. But she writes furious letters and has never hurt a soul: only a little more likely, 0.7.',
      'If Voss did it, nothing about that Tuesday changes: Clara still quarrelled with me, wrote this, and never sent it: as likely as not, 0.5.',
      'If Pip did it, nothing about that Tuesday changes: Clara still quarrelled with me, wrote this, and never sent it: as likely as not, 0.5.',
    ],
    trap: 'Vivid but weak evidence',
    lesson:
      'Vivid is not the same as strong. If the letter is only somewhat more likely under \u201CClara did it\u201D than under the other stories, it should only nudge her share, however dramatic it sounds.',
    lessonSimple:
      'An angry letter feels like a confession. But people write angry letters all the time and hurt no one. A clue only shifts suspicion as much as it fits one story better than the others. ' +
      'Notice how little the board moved: if your two ratings were far apart, it swung much further than a never-sent draft deserves.',
    reaction: [
      'Clara. She was so angry with me...',
      'Anger makes a vivid story: it has a face, a voice, a slammed door. But a vivid story isn\u2019t the same as a likely one.',
    ],
  },
  {
    id: 'boot',
    hintsSimple: {
      niece: 'If Clara did it, why would she come in through the conservatory? She has been inside since seven, and the front door has always been open to her. And this print is large and fresh. A muddy print under this window is very hard to explain in her story.',
      partner: 'If Voss did it, he signed my log at eight, said goodnight like a gentleman, and then had to get back in unseen. He parks by the garden gate, as he always does, and the beds lie between that gate and this very window. A print like this is quite possible in his story, though he might equally have found another way in.',
    },
    short: 'a muddy print hidden behind the fern',
    context: [
      'One boot print. Wet garden mud, the heel worn down on one side.',
      'It points into the house. Whoever left it was coming in, not going out. And the mud is still soft: this was made recently, not at some time this week.',
      'The window above it is unlatched. I latch that window myself every autumn. Someone came in through the garden tonight, by a window that is never left open. Who would be likely to leave a print like this?',
    ],
    leadIn: 'Cold air is moving through the house. It smells of wet earth, and it comes from the conservatory, at the far end.',
    title: 'A Muddy Boot Print',
    found: 'On the conservatory floor, hidden behind the big fern, right under the window, where Margaret\u2019s plants lean toward what is left of the moon.',
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
      'Clara has been inside since seven, and the front door is always open to her: unlikely, 0.1.',
      'Voss parks by the garden gate and walks across the beds: a fair chance, 0.5.',
      'Pip’s boots are ALWAYS muddy and he walks through here: likely, 0.8.',
    ],
    trap: 'Representativeness ("mud means gardener")',
    trapEasy: 'One lopsided clue can swing the board',
    lesson:
      'Mud says \u201Cgardener!\u201D But Voss crosses the same garden beds, and Pip spent the least time inside. What matters is not who a clue reminds you of, but how likely it is under each story, starting from where suspicion already was.',
    lessonSimple:
      'Only someone coming through the garden would leave this. Clara has been inside since seven; Voss parks by the garden gate. When a clue fits one story far better than another, a single clue can swing the whole board.',
    reactionEasy: [
      'Garden mud, under the open window. Who walks through a garden at night?',
      'Clara has been inside since seven, and this print is large. But Voss parks by the garden gate...',
    ],
    reaction: [
      'Garden mud. Pip, surely. It has to be Pip.',
      'Or anyone who came in through the garden gate tonight. Pip started as the least likely of all.',
    ],
  },
  {
    id: 'ledger',
    hintsSimple: {
      niece: 'If Clara did it, the business accounts have nothing to do with her. She has never once asked what Finch & Voss earns. Then this ledger is only a coincidence: an odd supplier, a partner who files badly. It would be unlikely, though not impossible.',
      partner: 'If Voss did it, here is his reason, laid out in columns: payments to a company I have never heard of, entered by him, and a partner who had just announced he wanted to see the books. In his story, a hidden ledger like this is exactly what you would expect to find.',
    },
    short: 'a ledger like this',
    context: [
      'Harrow & Pike Ltd. Five payments this year, none of them small, climbing from \u00A3340 to \u00A3610 and then dropping to \u00A3280. I know every supplier this firm has dealt with in twenty years, and I have never heard of Harrow & Pike.',
      'The entries are in Voss\u2019s hand, and the ledger was not with the other books. It was under blank invoices, in a drawer.',
      'If someone was stealing from the business and feared I was about to go through the books, that would be a reason to silence me. Or it may be an honest supplier I never met, and an untidy partner. That is the question.',
    ],
    leadIn: 'Voss kept the partnership books in his desk, in the office. In twenty years I never once opened that desk. Trust is a lovely thing to be buried with.',
    title: 'The Partnership Ledger',
    found: 'In the bottom drawer of Voss\u2019s desk, under a stack of blank invoices. Not in the cabinet with the other books. A thin ledger, kept apart.',
    evidence: { kind: 'table', columns: ['Date', 'Paid to', 'Amount'], rows: [
      ['3 March', 'Harrow & Pike Ltd', '\u00A3340'],
      ['11 April', 'Harrow & Pike Ltd', '\u00A3415'],
      ['2 June', 'Harrow & Pike Ltd', '\u00A3520'],
      ['19 August', 'Harrow & Pike Ltd', '\u00A3610'],
      ['7 October', 'Harrow & Pike Ltd', '\u00A3280'],
    ], foot: 'Total this year: \u00A32,165. Five payments to a firm I have never dealt with, entered in Voss\u2019s tidy hand and kept beneath a stack of blank invoices.' },
    likelihoods: [0.3, 0.3, 0.9, 0.3],
    reasons: [
      'If Graves did it, the ledger is only a coincidence: an odd supplier, a partner who files badly: unlikely, though not impossible, 0.3.',
      'If Clara did it, the ledger is only a coincidence: an odd supplier, a partner who files badly: unlikely, though not impossible, 0.3.',
      'If Voss did it, hiding his theft would be the reason, and this ledger is exactly what he would need to hide: very likely, 0.9.',
      'If Pip did it, the ledger is only a coincidence: an odd supplier, a partner who files badly: unlikely, though not impossible, 0.3.',
    ],
    trap: 'Motive evidence (genuinely diagnostic)',
    lesson:
      'This clue is lopsided: far more likely under one story than under all the others. The more lopsided the fit, the further the board moves, whether or not the clue is dramatic.',
    lessonSimple:
      'This clue fits one person far better than anyone else. That is what strong evidence looks like: not loud, just lopsided.',
    reaction: [
      'Voss. My partner. Stealing from me?',
      'This clue fits one person far better than anyone else. That is what strong evidence feels like.',
    ],
    reactionEasy: [
      'Voss. My partner. Stealing from me?',
      'This clue fits one person far better than anyone else. That is what strong evidence feels like.',
      'Careful, Alistair. I rated how likely this ledger would be *if Voss did it*. That is not the same as how likely it is that Voss did it. ' +
        'The first is a rating; the second is the board, and the board also depends on where I started and on how well the ledger fits Clara\u2019s story. ' +
        'Mix the two up and you have made the prosecutor\u2019s mistake, the one that has sent real people to prison.',
    ],
  },
  {
    id: 'phone',
    hintsSimple: {
      niece: 'If Clara put the draught in my tea, she had to stand at my desk some time between half past nine and ten. The log has her on the line to Edinburgh for that whole half hour. Her guilt and this log hardly fit together, unless the log is wrong, or the receiver was left lying on the table while she slipped away.',
      partner: 'If Voss did it, Clara\u2019s call is just Clara phoning someone from the hallway on a quiet night. A call this long, at this hour, is not guaranteed, but his guilt changes nothing about whether she made it. It neither helps nor hurts his story much.',
    },
    short: 'this telephone log',
    memory:
      'I\u2019m remembering something. This log has shaken it loose, the way the stain on my cuff did. Half past nine. {tea} ' +
      'A little before ten I drank it. Whoever put the draught in did it in that half hour, while the cup stood there.',
    context: [
      'Now the log. The first line is mine: brass, for the Hollis order. Nothing there. But Clara rings Edinburgh at 9:28 and stays on the line for twenty-nine minutes. Anyone on the telephone for all of it could hardly have been in my study.',
      'And here, at 7:48, a call for Voss. Two minutes. Twelve minutes later he signed out and left. I cannot tell what that means. It fits {stories}, so it stays off the scale. A clue I cannot weigh is a clue I must not pretend to weigh.',
    ],
    leadIn: 'Everything dialled out of this house is written down by the exchange. The switchboard log lives in the telephone table drawer, back in the hallway.',
    title: 'The Telephone Log',
    found: 'In the hallway telephone table drawer: the switchboard operator\u2019s log. The exchange writes down every call placed from this house: the time, the number, and how long the line stayed open.',
    evidence: { kind: 'table', columns: ['Time', 'Caller', 'Called', 'Length'], rows: [
      ['4:12 pm', 'Mr A. Finch', 'Hollis Brass Co.', '6 min'],
      ['7:48 pm', '(incoming)', 'for Mr E. Voss', '2 min'],
      ['9:28 pm', 'Miss C. Finch', 'Edinburgh 4471', '29 min'],
    ] },
    likelihoods: [0.5, 0.1, 0.5, 0.5],
    reasons: [
      'If Graves did it, Clara\u2019s evening call has nothing to do with it. She phones friends most evenings: about even odds, 0.5.',
      'If Clara did it, she had to stand at my desk between half past nine and ten, yet the log has her on the line for that whole half hour. Only a wrong log, or a receiver left lying on the table, would explain it: very unlikely, 0.1.',
      'If Voss did it, Clara\u2019s call is unrelated. She phones friends most evenings: about even odds, 0.5.',
      'If Pip did it, Clara\u2019s call is unrelated. She phones friends most evenings: about even odds, 0.5.',
    ],
    trap: 'Exculpatory evidence',
    lesson:
      'Evidence can clear people too. An alibi makes the clue very unlikely under one story, so that suspect\u2019s share shrinks, and what they lose is shared out among everyone else.',
    lessonSimple:
      'Evidence can clear people too. If Clara was on the telephone the whole time the tea sat on the desk, the clue hardly fits her story, so her share shrinks and the other suspect\u2019s grows. ' +
      'An alibi is rarely perfect (a log records a call, not who held the receiver), so her share shrinks a great deal but never to nothing.',
    reaction: [
      'Clara was on the telephone the whole time my tea sat on the desk. Twenty-nine minutes of Edinburgh.',
      'I am almost relieved. An alibi is evidence too: it moves belief off one person and onto everyone else.',
    ],
    reactionEasy: [
      'Clara was on the telephone the whole time my tea sat on the desk. Twenty-nine minutes of Edinburgh.',
      'I am almost relieved. An alibi is evidence too: it moves belief off one person, and it can only move it onto the other.',
    ],
  },
  {
    id: 'greenhouse',
    short: 'Pip\u2019s careful greenhouse log',
    context: [
      'Pip\u2019s notes put him in the greenhouse all evening, writing every ten minutes.',
      'Would someone busy poisoning my tea keep such a steady record?',
    ],
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
      'Remember the boot print that pointed at Pip? This alibi pushes the other way. Bayesian updating lets clues add up, and it lets them cancel out.',
    reaction: [
      'Dear Pip, counting temperatures while I fell asleep for good.',
      'The mud pointed at him; this points away. Evidence can cancel out evidence.',
    ],
  },
  {
    id: 'cufflink',
    hintsSimple: {
      niece: 'If Clara did it, the cufflink is still easy to explain. Voss sat in this very chair at our meeting this afternoon, and cufflinks fall off. It is as likely as not.',
      partner: 'If Voss did it, he stood in this room tonight as well as this afternoon, so he had two chances to lose it. His story explains it a little better, not overwhelmingly.',
    },
    short: 'a \u201CV\u201D cufflink under my chair',
    context: [
      'A cufflink. Silver, with a looping V. Voss wears a pair just like it. He wore them today, at our meeting and at supper; I remember them flashing when he signed.',
      'The other one is missing. But he also sat in this very chair this afternoon, hours before anything happened.',
    ],
    leadIn: 'The study again. My desk chair has been pushed back from the desk. Was something underneath it?',
    title: 'A Cufflink Engraved "V"',
    found: 'Under my desk chair, caught in the fringe of the rug, small and bright as a dropped tooth.',
    evidence: { kind: 'facts', rows: [
      ['Object', 'One silver cufflink'],
      ['Engraving', 'A looping \u201CV\u201D'],
      ['Its partner', 'Missing'],
    ] },
    likelihoods: [0.5, 0.5, 0.7, 0.5],
    reasons: [
      'If Graves did it, Voss could still have lost it at our meeting this afternoon, and cufflinks fall off: as likely as not, 0.5.',
      'If Clara did it, Voss could still have lost it at our meeting this afternoon, and cufflinks fall off: as likely as not, 0.5.',
      'If Voss did it, he stood in this room tonight as well as this afternoon, so he had two chances to lose it: a little more likely, 0.7.',
      'If Pip did it, Voss could still have lost it at our meeting this afternoon, and cufflinks fall off: as likely as not, 0.5.',
    ],
    trap: "Prosecutor's fallacy",
    trapEasy: 'A clue that fits both stories',
    lesson:
      'Don\u2019t confuse \u201Chow likely is this clue if Voss did it?\u201D with \u201Chow likely is it that Voss did it, given this clue?\u201D On its own the cufflink is modest. What convicts is the whole chain of evidence.',
    lessonSimple:
      'Voss\u2019s cufflink sounds like proof, but he sat at this desk this afternoon, so it would turn up in nearly any story. ' +
      'On its own it is a modest clue: when a clue would be found in both stories, it hardly moves the board, however much it feels like a smoking gun. What decides a case is everything together.',
    reaction: [
      'Voss\u2019s cufflink. It winks at me like an accusation. But he sat at this desk this afternoon...',
      'On its own it proves little. A single thread proves nothing; it is the weave that holds. Together with everything else, the picture is clear.',
    ],
  },
];

const EPILOGUE_SOURCE: Record<'easy' | 'wider', string[]> = {
  easy: [
    'Voss. My partner of twenty years.',
    'He was stealing from the business. I was about to discover it, so he signed my log at eight, and came back through the garden while the house was quiet.',
    'The loudest clue was the one with the least to say.',
    'The letter was loud and weak. The boot print, the ledger and the telephone log were quiet and lopsided, and together they spoke clearly.',
    'The cufflink hardly mattered at all.',
    'The ticking thins out, one clock at a time, until there is only one left, and then there is none. For the first time tonight, I can rest.',
  ],
  wider: [
    'Voss. My partner of twenty years.',
    'He was stealing from the business. I was about to discover it, so he signed my log at eight, and came back through the garden while the house was quiet.',
    'The loudest clues were not the strongest ones.',
    'The letter was loud and weak, and the mud pointed at the wrong man. The ledger and the alibis were quiet and lopsided, and together they spoke clearly.',
    'The ticking thins out, one clock at a time, until there is only one left, and then there is none. For the first time tonight, I can rest.',
  ],
};

export const EPILOGUE_WRONG = [
  'The accusation echoes through the empty house... and nothing happens.',
  'The clocks keep ticking. The case is not closed. Somewhere upstairs a floorboard settles, as if someone had been standing on it, listening.',
  'Perhaps a loud clue drowned out the quiet ones?',
];

/** What the ghost says at the accusation . */
export const ACCUSE_LINES = [
  'Back beside my body. The clocks have gone quiet, as if they too are waiting. It is time to name the culprit.',
  'Your board shows these beliefs. Who did it?',
  'A bar is a belief, not a verdict. If it were close, I would have to ask how bad it would be to accuse the wrong person, and not only who looks likelier.',
  'Choose carefully. A ghost only gets one accusation.',
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
export let MEMORY_INTRO = '';
export let EPILOGUE_CORRECT: string[] = [];

const ORDINALS = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
const listNames = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/** Every suspect in the story (in log order), including those a difficulty leaves out. */
export const allSuspects = () => ALL_SUSPECTS;

/** Fill a lesson template's {suspect} placeholders from any distribution over the active suspects. */
/**
 * The ghost's hint for a story: its reasoning, with the verdict removed. Reasons read
 * "situation: verdict, number." and the hint keeps only the situation.
 */
export function hintOf(reason: string): string {
  const cut = reason.lastIndexOf(':');
  const base = cut > 0 ? reason.slice(0, cut) : reason.replace(/[:,]?\s*\d+(\.\d+)?\.$/, '');
  return base.replace(/[\s,;]+$/, '') + '.';
}

export function fillLesson(template: string, dist: number[]): string {
  return template.replace(/\{(butler|niece|partner|gardener)\}/g, (_m, id: string) => {
    const k = SUSPECTS.findIndex((s) => s.id === id);
    return k < 0 ? '' : fmtPct(dist[k]);
  });
}

function fmtPct(x: number) {
  return `${Math.round(x * 100)}%`;
}

/** Select the suspects and clues for a level (easy = Level 1, medium = Level 2, hard = Level 3). */
export function setCase(difficulty: Difficulty) {
  const setup = CASE_SETUP[difficulty];
  const idx = setup.suspects.map((id) => ALL_SUSPECTS.findIndex((s) => s.id === id));
  SUSPECTS = idx.map((i) => ALL_SUSPECTS[i]);
  CULPRIT_INDEX = SUSPECTS.findIndex((s) => s.id === 'partner');
  const sources = setup.clues.map((id) => ALL_CLUES.find((c) => c.id === id)!);

  const total = SUSPECTS.reduce((a, s) => a + s.hoursInside, 0);
  const ns = SUSPECTS.length;
  const grave = SUSPECTS.some((s) => s.id === 'butler');
  const fill = (t: string) =>
    t
      .replace('{other}', ns === 2 ? 'the other' : 'the others')
      .replace('{stories}', ns === 2 ? 'either story as well as the other' : 'every story about equally')
      .replace(
        '{tea}',
        grave
          ? 'Graves carried my tea to the desk, as he does every night, and set it down beside the blotter.'
          : 'I carried my tea to the desk myself and set it down beside the blotter.',
      );

  CLUES = sources.map((src, n) => {
    const likelihoods = idx.map((i) => src.likelihoods[i]);
    const easy = difficulty === 'easy';
    return {
      id: src.id,
      title: src.title,
      found: src.found,
      evidence: src.evidence,
      context: src.context.map(fill),
      memory: src.memory && fill(src.memory),
      short: src.short,
      likelihoods,
      reasons: idx.map((i) => src.reasons[i]),
      trap: (easy && src.trapEasy) || src.trap,
      lesson: (easy && src.lessonSimple) || src.lesson,
      hints: idx.map((i) => (easy && src.hintsSimple?.[ALL_SUSPECTS[i].id]) || hintOf(src.reasons[i])),
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
      .replace('{pronoun}', top.pronoun)
      .replace('{absent}', absentNotes.length ? ' ' + absentNotes.join(' ') : '')
      .replace('{leaves}', absentNotes.length ? 'That leaves' : 'That makes')
      .replace(/\{count\}/g, WORDS[ns])
      .replace('{names}', listNames(SUSPECTS.map((s) => s.name)))
      .replace('{nth}', ORDINALS[ns + 1]);
  PRIOR_SHEET = {
    ...PRIOR_SOURCE,
    text: fillPrior(PRIOR_SOURCE.text),
    context: fillPrior(PRIOR_SOURCE.context),
    total,
    lesson: difficulty === 'easy' ? PRIOR_SOURCE.lessonSimple : fillPrior(PRIOR_SOURCE.lesson),
    reaction: PRIOR_SOURCE.reaction.map(fillPrior),
    nextThought: sources[0].leadIn,
  };
  const count = WORDS[ns];
  MEMORY_INTRO = MEMORY_INTRO_SOURCE.replace('{Count}', count[0].toUpperCase() + count.slice(1));
  EPILOGUE_CORRECT = EPILOGUE_SOURCE[difficulty === 'easy' ? 'easy' : 'wider'];
}

setCase('hard');
