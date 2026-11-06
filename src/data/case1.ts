/**
 * "The Clockmaker's Last Hour": the whole game's story and probability model, as data.
 * One night, one hour, two suspects (Clara and Voss), seven clues.
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
  /** What they did tonight (consistent with the household log). */
  tonight: string;
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
  /** A memory the clue shakes loose, shown (in amber) before the ghost's reading. */
  memory?: string;
  /** Stage direction for the memory (screenplay only). */
  memoryCue?: string;
  /** The ghost's reading of it, one thought at a time, before any analysis. */
  context: string[];
  /** Short name used in questions: "How likely would I be to find ___?" */
  short: string;
  /** The intended ratings as likelihoods, P(this clue | suspect i did it): a model answer, never shown. */
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
      'This week I told her I meant to leave the house to the Clockmakers’ Guild instead of to her. We both said things we regret.',
    tonight: 'She came back from a long walk at seven and went upstairs. After supper I did not see her again.',
    logIn: '7:00 pm', logOut: '10:00 pm (still in)', pronoun: 'she',
    voices: {
      cue: 'The memory sharpens into voices, an argument carried down a staircase.',
      lines: [
        ['Clara', 'To a *guild*, Uncle?'],
        ['John', 'It’s a house, Clara. It’s bricks.'],
        ['Clara', 'It’s the last place they were here.'],
      ],
    },
  },
  {
    id: 'partner', name: 'Mr. Voss', role: 'the business partner', color: 0xffd27a, hoursInside: 2,
    memory: 'Edmund Voss, my partner at Bayes & Voss Clockworks. He smiles a little too much.',
    backstory:
      'We founded the business twenty years ago: my hands, his head for numbers. It made us both comfortable. ' +
      'But lately the accounts stopped making sense to me, and last week I told him I wanted to go through the books myself, on Monday, at eleven.',
    tonight: 'He came at four with papers to sign and parked, as he always does, by the garden gate. He stayed to supper and signed out at eight.',
    logIn: '4:00 pm (before the window)', logOut: '8:00 pm', pronoun: 'he',
    voices: {
      cue: 'A second voice, warm and unhurried.',
      lines: [['Voss', 'The books? Of course, John. Whenever you like.']],
      after: 'He said it smiling. He says everything smiling.',
    },
  },
];

/** The whole household log: the suspects, and the two who were out tonight. [name, in, out, inside] */
export const LOG_ROWS: string[][] = [
  ['Graves', '—', 'not in tonight (evening off)', '—'],
  ['Clara', '7:00 pm', '10:00 pm (still in)', '3 h'],
  ['Mr. Voss', '4:00 pm (before the window)', '8:00 pm', '2 h'],
  ['Pip', '—', 'out 6:00 pm (went home)', '—'],
];

export const CULPRIT_INDEX = 1;

// ---------------------------------------------------------------- the opening

/** Thrown into ghostly existence: no memory, no context. */
export const AWAKEN_LINES: string[] = [
  '...',
  'It’s dark.',
  'And cold. Too cold...',
  'I hear a clock ticking. No... many clocks. Familiar yet unfamiliar.',
  'I don’t remember getting here.',
  'I don’t remember anything at all. My name feels like an itch I can’t scratch.',
];

/** Beat: drifting to the grandfather clock and reaching for it. */
export const CLOCK_LINES: string[] = [
  'A grandfather clock. I know this clock.',
  'As if my hands know something my head has lost.',
  'Did I... build it?',
];
export const CLOCK_AFTER: string[] = ['My hand went straight through the wood...', 'As if the clock were the real thing, and I were a shadow.'];

/** Beat: the window that shows no reflection. */
export const WINDOW_LINES: string[] = [
  'The window...',
  'There should be a face reflected in this glass.',
  'I see nothing. Only the room behind me, and the moon.',
  'What... am I?',
];

/** Shown once the player can move again. */
export const DRIFT_HINT: string[] = ['I see something lying on the rug. Very still.', 'I do not want to look at it. But I must.'];

/** Discovering the body: paced with silences. */
export const BODY_LINES: string[] = [
  'Someone is lying here.',
  'So still. Like a reflection of me.',
  'That coat. Those hands. The ink stain on the left cuff, the one that never washed out.',
  'Margaret. The name comes up out of nowhere, and with it a kitchen, a bottle of vinegar, then salt, then her laughing and giving up and calling it my signature. My wife. A scrap of memory, small as a coin, and gone again.',
  '...',
  '...it’s me.',
  'That is my body. I am standing over my own body, like a man who has come in out of the rain and found a stranger in his chair, and the stranger has his face.',
  'My name... my name is John Bayes. I make clocks.',
  'I made clocks.',
  'I see no bullet wounds. No knife in me. Nothing is broken. Just... asleep, and never waking.',
  'Wait, I remember my evening tea...',
  'It is coming back to me. I made it myself. When, exactly, I cannot say; that part is still fog. But it tasted bitter tonight. I remember thinking so. I remember thinking it tasted a bit foul, and drinking it anyway.',
  'Someone must have put something in my tea.',
  'Someone in this house did this to me.',
];

/** After the flash: the memory starts to surface. */
export const BODY_AFTER: string[] = [
  'A memory is coming up through the fog of my mind.',
  'Faces. Voices. I am remembering something... let it come.',
];

export const MEMORY_INTRO = 'I’m remembering something. Who was here tonight. Two of them.';

export const MEMORY_OUTRO = [
  'That is all it will give me. Names, faces, the shape of an evening. Everything after supper is still fog.',
  'But memories seem to come back when I stand close to the things they belong to. I felt it with the stain on my cuff. If I find the right things, perhaps more will come.',
  'The hall clock struck ten as I woke. I can feel what is left of this night the way you feel a tide turning: there is an hour in it, no more.',
  'Every night since she was twelve, Clara has come down at eleven to say goodnight. I remember that much. Even when we are not speaking. Especially then.',
  'At eleven she will find me, and after that I think I will be gone, and whoever did this will have the whole world to hide in.',
  'One of them did this.',
  'Already my gut whispers a name. I have spent my life distrusting any part that fits too easily.',
  'A gut feeling is how the living get things wrong. I am no longer living. Perhaps I can do better.',
  'I will gather what I can find, and weigh each piece honestly.',
];

export const AFTER_MEMORY_THOUGHTS: string[] = [
  'One hour. Where to begin...',
  'Even dead, I am a man who begins with the paperwork. Everyone who comes and goes signs the household log; I remember insisting on it. It should be on the side table.',
];

// ---------------------------------------------------------------- the prior

const TOTAL_HOURS = SUSPECTS.reduce((a, s) => a + s.hoursInside, 0);

/** The household log, which sets the prior. */
export const PRIOR_SHEET = {
  id: 'log',
  title: 'The Household Log',
  total: TOTAL_HOURS,
  text:
    'This was my own rule, and I remember the day I made it: everyone signs the household log when they come and go, the vicar included. A house should know who is in it. ' +
    'It shows who was inside tonight between 6 pm and 10 pm, and for how long. Graves had asked for the evening off to visit his sister; I remember saying yes. That is why I made my own tea. ' +
    'Pip went home at six, as he always does. That leaves two people who were in this house with my tea: Clara and Mr. Voss. Everything I weigh from here on is a contest between those two. ' +
    'If I have overlooked a third, none of it will be worth much. If you had asked me this morning whether Clara or Edmund would poison my tea, I would have laughed at either. ' +
    'But someone did, so the question is no longer whether such a person exists. It is which of the two.',
  context:
    'Before I weigh a single clue, I need somewhere to stand. I do not yet know when anyone could have reached my tea, so I will count the hours each of them spent under this roof: ' +
    'the longer someone was here, the more chances they had. That starting belief is called the PRIOR. It is a judgment, not a fact. ' +
    `In total, the log shows ${TOTAL_HOURS} hours’ worth of visitors in my mansion.`,
  lesson:
    'Before finding any clues, suspicion starts where the opportunity was: whoever spent longest in the house starts highest. That’s my starting point. Every clue from here on out will update and shift it.',
  reaction: [
    'Clara was here the longest, so she starts as the likeliest. But that doesn’t mean guiltiest yet.',
    'Every piece of evidence from now on should shift these shares. By how much is the whole question.',
  ],
  nextThought: '',
};

// ---------------------------------------------------------------- the clues

type ClueSource = Omit<Clue, 'nextThought'> & { leadIn: string };

const CLUE_SOURCES: ClueSource[] = [
  {
    id: 'letter',
    title: 'An Angry Letter',
    leadIn:
      'Clara’s room is upstairs. I know my niece. When she is angry, Clara writes. She always has: pages of it, scorching, and then she never sends them. If she wrote to me after our quarrel, the draft will be in her writing desk.',
    searchCue: 'The drawer sticks, then slides out with a small wooden cry',
    found: 'Folded small, then smaller, at the back of Clara’s writing-desk drawer. A draft, crossed out and rewritten, the nib pressed so hard on the last line that it nearly tore the paper.',
    evidence: { kind: 'letter', date: 'Tuesday', lines: ['Uncle —', 'If you change your will, I will NEVER forgive you!'], sign: 'C.' },
    context: [
      'Tuesday. Three days ago: the day we quarrelled about my will. A letter in a drawer is a letter nobody read.',
      'It shows strong feelings, maybe even a motive. But someone really was poisoned tonight, so the question is not whether anger leads to murder. It is whether this letter fits one story better than the other.',
    ],
    short: 'an angry letter like this',
    likelihoods: [0.7, 0.5],
    hints: [
      'If Clara did it, the quarrel over my will would be her reason, and a furious letter is exactly the footprint that kind of anger leaves. But Clara writes furious letters all the time, and has never hurt a soul. So her guilt makes this letter more expected, though not by a huge margin.',
      'If Voss did it, nothing about that Tuesday changes. Clara and I still quarrelled, she still went upstairs and wrote the most savage thing she could think of, and she still didn’t send it to me. His guilt does not stop this letter existing, so it is only a little less expected here than in her story.',
    ],
    trap: 'Vivid but weak evidence',
    lesson:
      'An angry letter feels like a confession. But people write angry letters all the time and hurt no one. A clue only shifts suspicion as much as it fits one story better than the others. ' +
      'Notice how little the board moved: if your two ratings were far apart, it swung much further than a never-sent draft deserves.',
    reaction: ['Clara. She was so angry with me...', 'Anger makes a vivid story. But a vivid story isn’t the same as a likely one.'],
  },
  {
    id: 'will',
    title: 'The Draft Will',
    leadIn: 'Clara’s letter was about my will. Let me see what I actually wrote. The draft should be in my desk drawer.',
    searchCue: 'Beneath the pencils and the coiled mainsprings lies a page folded in three',
    found: 'Under the pencils in my desk drawer, folded in three. My own handwriting.',
    evidence: {
      kind: 'facts',
      rows: [
        ['Document', 'A will in my hand, unsigned'],
        ['The house', 'To the Clockmakers’ Guild'],
        ['To Clara', 'The grandfather clock and my watch'],
        ['Signing', 'Monday, 10 a.m., Mr. Penrose, solicitor'],
        ['Pencilled in the margin', '“C. — think first. Talk to her.”'],
      ],
    },
    context: [
      'The will. Exactly as I told her: the house to the Guild, and to Clara a clock and a watch. No wonder she was angry.',
      'It’s unsigned. Mr. Penrose is due on Monday at ten, and Edmund and the books at eleven. Two appointments, and two people with a reason to stop me keeping them.',
      'And the note in the margin: *Talk to her.* I wasn’t sure. I never told her I wasn’t sure.',
      'But is this news? I knew about the quarrel before I opened the drawer.',
    ],
    short: 'a draft will like this in my desk',
    likelihoods: [0.9, 0.9],
    hints: [
      'If Clara did it, I still told her about the will on Tuesday, and I still drafted it. A draft in my own desk is very likely.',
      'If Voss did it, nothing about the will changes. I still told Clara, and I still drafted it. A draft in my own desk is just as likely.',
    ],
    trap: 'Old news doesn’t count twice',
    lesson:
      'A will in my desk feels like a motive for Clara. But I knew about the quarrel before I opened the drawer, and the letter already carried it. ' +
      'The draft would be in this drawer whoever did this, so it moves nothing. If your two ratings were far apart, you counted the same quarrel twice.',
    reaction: [
      'Nothing moved. That feels wrong, but it isn’t: I knew about the will before I opened the drawer.',
      '*Talk to her.* I never did.',
    ],
  },
  {
    id: 'boot',
    title: 'A Muddy Boot Print',
    leadIn: 'There’s cold air moving through the house. It smells of wet earth, and it’s coming from the conservatory.',
    searchCue: 'The fronds part and settle again',
    found: 'On the conservatory floor, hidden behind the big fern, right under the window.',
    evidence: {
      kind: 'facts',
      rows: [
        ['Mark', 'One boot print, in wet garden mud'],
        ['Size', 'Large, with a worn heel'],
        ['Pointing', 'Into the house'],
        ['Window above', 'Unlatched'],
        ['Mud', 'Still soft'],
      ],
    },
    context: [
      'One boot print. Wet garden mud, the heel worn down on one side.',
      'It points into the house, so whoever left it was coming in. And the mud is still soft. It was made recently.',
      'The window above it is unlatched. I latch that window myself every autumn. Someone came in through the garden tonight. Who would be likely to leave a print like this?',
    ],
    short: 'a muddy print hidden behind the fern',
    likelihoods: [0.1, 0.5],
    hints: [
      'If Clara did it, why would she come in through the conservatory? She has been inside since seven, and the front door has always been open to her. And this print is large and fresh. A print like this is very hard to explain in her story.',
      'If Voss did it, he signed my log at eight and then had to get back in unseen. He parks by the garden gate, as he always does, and the beds lie between that gate and this window. A print like this is quite possible in his story, though he might have found another way in.',
    ],
    trap: 'One lopsided clue can swing the board',
    lesson:
      'Only someone coming through the garden would leave this. Clara has been inside since seven; Voss parks by the garden gate. When a clue fits one story far better than another, a single clue can swing the whole board.',
    reaction: [
      'Garden mud, under the open window. Who walks through a garden at night?',
      'Clara has been inside since seven, and this print is large. But Voss parks by the garden gate...',
    ],
  },
  {
    id: 'ledger',
    title: 'The Partnership Ledger',
    leadIn: 'Voss kept the partnership books in his desk, in the office. In twenty years I never once opened it.',
    searchCue: 'The bottom drawer is stiff; it gives all at once',
    found: 'In the bottom drawer of Voss’s desk, under a stack of blank invoices. Not in the cabinet with the other books. A thin ledger, kept apart.',
    evidence: {
      kind: 'table',
      columns: ['Date', 'Paid to', 'Amount'],
      rows: [
        ['3 March', 'Harrow & Pike Ltd', '£340'],
        ['11 April', 'Harrow & Pike Ltd', '£415'],
        ['2 June', 'Harrow & Pike Ltd', '£520'],
        ['19 August', 'Harrow & Pike Ltd', '£610'],
        ['7 October', 'Harrow & Pike Ltd', '£280'],
      ],
      foot: 'Total this year: £2,165. Five payments to a firm I have never dealt with, entered in Voss’s tidy hand and kept beneath a stack of blank invoices.',
    },
    context: [
      'Harrow & Pike Ltd. Five payments this year, from £340 up to £610, then down to £280. I know every supplier this firm has dealt with in twenty years, and I’ve never heard of Harrow & Pike.',
      'The entries are in Voss’s hand, and the ledger wasn’t with the other books. It was hidden under blank invoices.',
      'If someone was stealing from the business and feared I was about to go through the books, that would be a reason to silence me. Or it may be an honest supplier I never met, and an untidy partner. That is the question.',
    ],
    short: 'a ledger like this',
    likelihoods: [0.3, 0.9],
    hints: [
      'If Clara did it, the business accounts have nothing to do with her. She has never once asked what Bayes & Voss earns. So this ledger would only be a coincidence: an odd supplier, a partner who files badly. Unlikely, though not impossible.',
      'If Voss did it, here is his reason: payments to a company I have never heard of, entered by him, and a partner who had just said he wanted to see the books. In his story, a hidden ledger like this is exactly what I’d expect to find.',
    ],
    trap: 'Motive evidence (genuinely diagnostic)',
    lesson: 'This clue fits one person far better than anyone else. That is what strong evidence looks like: not loud, just lopsided.',
    reaction: [
      'Voss. My partner. Stealing from me?',
      'This clue fits one person far better than the other. That’s what strong evidence looks like.',
      'Careful, John. I rated how likely this ledger would be *if Voss did it*. That isn’t the same as how likely it is that Voss did it. ' +
        'The first is a rating; the second is the board, which also depends on where I started and on how well the ledger fits Clara’s story. ' +
        'Mixing the two up is called the prosecutor’s fallacy, and it has sent real people to prison.',
      'Everything is pointing at Edmund. That is exactly when I should be most careful. I haven’t looked for anything that would count against him.',
    ],
  },
  {
    id: 'slip',
    title: 'The Chemist’s Slip',
    leadIn: 'Clara walked at seven, in her grey coat. It should be on the hall stand.',
    searchCue: 'Clara’s grey walking coat hangs among the others; the paper in its pocket stirs as the ghost’s hand passes through',
    found: 'In the pocket of Clara’s grey walking coat, on the hall stand. A small slip of paper, folded once.',
    evidence: {
      kind: 'facts',
      rows: [
        ['Shop', 'Hartley & Son, Dispensing Chemists'],
        ['Time', 'Friday, 6:40 pm'],
        ['Item', 'One small bottle, sleeping drops (1 oz)'],
        ['Price', '2s 6d'],
        ['Name on slip', 'None'],
      ],
    },
    context: [
      'Hartley’s, the chemist on the corner. Six-forty on Friday evening, twenty minutes before she came home.',
      'Sleeping drops. Graves fetches mine, on the first of the month, and I never asked Clara to fetch them. She has never needed any. Clara sleeps like the dead.',
      'Tonight I fell asleep and didn’t wake. The tea was bitter. So are sleeping drops.',
      'I’ve been so busy being clever about Voss. Now I have a clue I didn’t want.',
    ],
    short: 'a chemist’s slip like this in Clara’s coat',
    likelihoods: [0.7, 0.3],
    hints: [
      'If Clara did it, she needed something to put a man to sleep and keep him there, and sleeping drops would do that. She might have kept the slip, because people forget what is in a pocket. It is quite likely, though she could as easily have thrown it away.',
      'If Voss did it, Clara was simply out for a walk. She knows I sleep badly, and she has nagged me about it since the spring, so a kindness is possible. But I never asked her to fetch my drops, and she has never taken any herself. Sleeping drops on this very evening would be a coincidence. Unlikely, though not impossible.',
    ],
    trap: 'Evidence against your favourite',
    lesson:
      'Voss was running away with the board, and this slip pulls Clara back into the race. A clue does not care whom you suspect. ' +
      'It fits one story better than the other, and your job is to say which, even when you had stopped looking. The clues you want least are the ones you most need to weigh.',
    reaction: [
      'The board has swung back. Clara is a real suspect again, and I’m ashamed of how little I wanted that.',
      'Six-forty. Sleeping drops. Twenty minutes later she came through the front door and went upstairs.',
    ],
  },
  {
    id: 'phone',
    title: 'The Telephone Log',
    leadIn: 'It all comes down to half past nine. The exchange writes down every call made from this house. That log is in the telephone table drawer, in the hallway.',
    searchCue: 'The drawer slides out',
    found: 'In the hallway telephone table drawer: the switchboard operator’s log. The exchange writes down every call placed from this house: the time, the number, and how long the line stayed open.',
    evidence: {
      kind: 'table',
      columns: ['Time', 'Caller', 'Called', 'Length'],
      rows: [
        ['4:12 pm', 'Mr J. Bayes', 'Hollis Brass Co.', '6 min'],
        ['7:48 pm', '(incoming)', 'for Mr E. Voss', '2 min'],
        ['9:28 pm', 'Miss C. Bayes', 'Edinburgh 4471', '29 min'],
      ],
    },
    memoryCue: 'MEMORY. A flicker: a cup set down on a blotter, the saucer chiming against the wood. Somewhere in the house, a clock strikes the half hour.',
    memory:
      'I’m remembering something. Half past nine. I carried my tea to the desk myself and set it down beside the blotter. A little before ten I drank it. Whoever put something in it did so in that half hour, while the cup stood there.',
    context: [
      'Now the log. The first line is mine: brass, for the Hollis order. Nothing there. But Clara rings Edinburgh at 9:28 and stays on the line for twenty-nine minutes. Anyone on the phone for all of that time could hardly have been in my study.',
      'And here, at 7:48, a call for Voss. Two minutes. Twelve minutes later he signed out. I can’t tell what that means. It fits either story equally well, so it stays off the scale. A clue I can’t weigh is one I mustn’t pretend to weigh.',
    ],
    short: 'this telephone log',
    likelihoods: [0.1, 0.5],
    hints: [
      'If Clara put something in my tea, she had to stand at my desk some time between half past nine and ten. The log has her on the line to Edinburgh for that whole half hour. Her guilt and this log hardly fit together. Either the exchange got twenty-nine minutes wrong, or she left the receiver on the table and slipped away. Both could happen. Neither is likely.',
      'If Voss did it, Clara’s call is just Clara phoning someone from the hallway. A call this long, at this hour, isn’t guaranteed, but his guilt changes nothing about whether she made it. It neither helps nor hurts his story much.',
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
    id: 'cufflink',
    title: 'A Cufflink Engraved "V"',
    leadIn: 'Back to the study. My desk chair has been pushed back from the desk. Was something underneath it?',
    searchCue: 'Something small catches the moonlight in the fringe of the rug',
    found: 'Under my desk chair, caught in the fringe of the rug.',
    evidence: {
      kind: 'facts',
      rows: [
        ['Object', 'One silver cufflink'],
        ['Engraving', 'A looping “V”'],
        ['Its partner', 'Missing'],
      ],
    },
    context: [
      'A cufflink. Silver, with a looping V. Voss wears a pair just like it. He wore them today, at our meeting and at supper; I remember them flashing when he signed.',
      'The other one is missing. But he also sat in this very chair this afternoon, hours before anything happened.',
    ],
    short: 'a “V” cufflink under my chair',
    likelihoods: [0.5, 0.7],
    hints: [
      'If Clara did it, the cufflink is still easy to explain. Voss sat in this very chair at our meeting this afternoon, and cufflinks fall off. It is as likely as not.',
      'If Voss did it, he stood in this room tonight as well as this afternoon, so he had two chances to lose it. His story explains it a little better, not overwhelmingly.',
    ],
    trap: 'A clue that fits both stories',
    lesson:
      'Voss’s cufflink sounds like proof, but he sat at this desk this afternoon, so it would turn up in nearly any story. ' +
      'On its own it is a modest clue: when a clue would be found in both stories, it hardly moves the board, however much it feels like a smoking gun. ' +
      'A clue can be likely in a story and still prove little, if it would turn up almost anywhere. What decides a case is everything together.',
    reaction: [
      'Voss’s cufflink. It looks like an accusation. But he sat at this desk this afternoon...',
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
  'Your board shows these beliefs. Who did it?',
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
  { who: 'ghost', text: 'Voss. My partner of twenty years.' },
  { who: 'ghost', text: 'Let me tell it the way it must have gone. I wasn’t there for it. I can only say what the evidence leaves standing.' },
  {
    who: 'direction', beat: 'reconstruct',
    text: 'RECONSTRUCTION. The amber returns, but this isn’t memory: the ghost is piecing it together from what he found. Everything in this scene is imagined, and the ghost says so.',
  },
  { who: 'imagining', text: 'Before he left at eight, Edmund lifted the latch of the conservatory window, the one I latch myself every autumn. I never noticed.' },
  { who: 'imagining', text: 'He signed my log, shook my hand, and went out smiling. He didn’t go home. He sat in his car by the garden gate, with the wet beds between him and my study window, and waited for me to make my tea.' },
  { who: 'imagining', text: 'At half past nine I carried my cup to the desk and set it down. Then I left the room for a few minutes, I think. That part is still fog.' },
  { who: 'imagining', text: 'Boots in the wet earth. The window rising. A hand with a silver cuff, and a little brown bottle. Then out the way he came, and one cufflink left in the fringe of the rug. Where he got the bottle, I’ll never know.' },
  { who: 'imagining', text: 'And Clara, in the hall, on the telephone to Edinburgh for twenty-nine minutes, with her back to all of it.' },
  { who: 'imagining', text: 'Who rang him at 7:48, I’ll never know either. It was never on the scale, and the verdict doesn’t need it. A case doesn’t have to explain every scrap.' },
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
  { who: 'ghost', text: 'The parcel. Brown paper and string, and a card in her handwriting: *For sleeping. I’m sorry about the house. C.* A small bottle from Hartley’s, bought at six-forty. She’s been in that kitchen for an hour, working up the courage to give it to me.' },
  { who: 'ghost', text: 'The clue that nearly condemned her was an olive branch. I rated it unlikely, and it was unlikely, and it still happened. Unlikely doesn’t mean never.' },
  { who: 'clara', how: 'whispering', text: 'You were right. It’s only bricks. I don’t care about the bricks. I’m sorry, Uncle. I’m so sorry.' },
  { who: 'ghost', text: 'It was never about the bricks, Clara. You’ll find the will in my drawer, with my note in the margin: *Talk to her.* I’d tear it in half if I had hands.' },
  { who: 'ghost', text: 'Tomorrow they’ll find the ledger under the blank invoices, the print behind the fern, and a man with one cufflink. Tonight there’s only this: a girl on the floor of my study, talking to me as if I could hear.' },
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
