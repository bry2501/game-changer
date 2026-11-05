/**
 * Case 1: "The Clockmaker's Last Hour".
 * All story content and the probability model live here as data.
 * Suspect order is fixed everywhere: [Butler, Niece, Partner, Gardener].
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
}

export interface Clue {
  id: string;
  room: number;
  x: number;
  title: string;
  /** What the ghost sees. */
  text: string;
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
  /** The ghost's thought pointing toward the next clue. */
  nextThought: string;
}

export interface Room {
  name: string;
  /** Top and bottom gradient colours of the room's back wall. */
  wallTop: number;
  wallBottom: number;
}

export const ROOM_WIDTH = 1280;

export const CASE_TITLE = "The Clockmaker's Last Hour";

export const SUSPECTS: Suspect[] = [
  { id: 'butler', name: 'Graves', role: 'the butler', color: 0x8fb3ff, hoursInside: 3.5,
    memory: 'My butler for thirty years. He brings my tea at nine every night, as he has since my wife passed. He says little, and notices everything.' },
  { id: 'niece', name: 'Clara', role: 'the niece', color: 0xff9fc6, hoursInside: 3,
    memory: 'My niece, bright and stubborn, staying with us this week. We argued about my will. I said things I regret.' },
  { id: 'partner', name: 'Mr. Voss', role: 'the business partner', color: 0xffd27a, hoursInside: 2,
    memory: 'My partner at Finch & Voss Clockworks for twenty years. He came this afternoon with papers to sign, and smiled a little too much.' },
  { id: 'gardener', name: 'Pip', role: 'the gardener', color: 0x9ff0b0, hoursInside: 1.5,
    memory: 'The gardener. Muddy boots, kind eyes. He talks to the orchids more than to people, and keeps careful notes on every one.' },
];

export const CULPRIT_INDEX = 2;

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
  'Graves keeps a log of everyone who comes and goes. It should be on the side table.',
];

/** The first time the ghost drifts into each room. */
export const ROOM_THOUGHTS: string[] = [
  '',
  'The hallway. Portraits of Finches long gone. Soon, I suppose, mine will hang here too.',
  'The conservatory. Cold glass, sleeping plants. That window is open. It never is.',
  'The office. Twenty years of Finch & Voss in these ledgers.',
];

/** The opportunity sheet that sets the prior. */
export const PRIOR_SHEET = {
  id: 'log',
  room: 0,
  x: 620,
  title: "Graves's Household Log",
  text:
    'The butler keeps a log of who was inside the house tonight, between 6 pm and 10 pm. ' +
    'Before looking at any clues, the more time someone spent inside, the more opportunity they had. ' +
    'That is our PRIOR: our belief before the evidence.',
  lesson:
    'Prior = opportunity. Divide each person’s hours inside by the total (10 hours). ' +
    'Graves starts as the most likely suspect, but only because he was home the longest.',
  reaction: [
    'Graves was home the longest, so he starts as the likeliest. That is opportunity, not guilt.',
    'Every clue from now on should shift these numbers. By how much is the whole question.',
  ],
  nextThought: 'My teacup is still on the desk...',
};

export const CLUES: Clue[] = [
  {
    id: 'teacup',
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
    nextThought: 'I heard paper rustling in the hallway...',
  },
  {
    id: 'letter',
    room: 1,
    x: 1900,
    title: 'An Angry Letter',
    text:
      'A crumpled letter from Clara: "Uncle, if you change your will, I will NEVER forgive you!"',
    likelihoods: [0.3, 0.6, 0.3, 0.3],
    reasons: [
      'Clara and I argued all month. A letter like this could turn up whoever the culprit was: somewhat unlikely, 0.3.',
      'If Clara were the culprit, an angry letter fits: twice as likely as otherwise, 0.6.',
      'Same as for Graves: the argument happened regardless, 0.3.',
      'Same as for Graves: the argument happened regardless, 0.3.',
    ],
    trap: 'Vivid but weak evidence',
    lesson:
      'Angry words are dramatic, but plenty of people write angry letters and harm no one. ' +
      'The likelihood ratio is only 2: it doubles Clara’s odds, so she is now the top suspect at about 45%. That is not a confession.',
    reaction: [
      'Clara. She was so angry with me...',
      'Anger makes a vivid story. But a vivid story isn\u2019t the same as a likely one.',
    ],
    nextThought: 'A cold draft blows in from the conservatory...',
  },
  {
    id: 'boot',
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
      'Prior × likelihood: Pip and Voss end up close (38% vs 32%). The clue points to the GARDEN, not one person.',
    reaction: [
      'Garden mud. Pip, surely. It has to be Pip.',
      'Or anyone who came in through the garden gate tonight. Pip started as the least likely of all.',
    ],
    nextThought: 'Voss always kept the partnership books in the office...',
  },
  {
    id: 'ledger',
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
      'Voss jumps to about 62%. Notice that it took a strong likelihood ratio, not a vivid story.',
    reaction: [
      'Voss. My partner. Stealing from me?',
      'This clue fits one person far better than anyone else. That is what strong evidence feels like.',
    ],
    nextThought: 'The telephone switchboard log is on the office desk...',
  },
  {
    id: 'phone',
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
      'Her probability collapses to about 1%, and the others share what she loses.',
    reaction: [
      'Clara was on the telephone when my tea was poured.',
      'I am almost relieved. An alibi is evidence too: it pushes belief away from someone.',
    ],
    nextThought: 'Pip keeps a greenhouse log... back in the conservatory.',
  },
  {
    id: 'greenhouse',
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
      'Bayesian updating lets evidence add up AND cancel out. Pip drops to about 4%.',
    reaction: [
      'Dear Pip, counting temperatures while I fell asleep for good.',
      'The mud pointed at him; this points away. Evidence can cancel out evidence.',
    ],
    nextThought: 'Something glinted under my desk in the study...',
  },
  {
    id: 'cufflink',
    room: 0,
    x: 1110,
    title: 'A Cufflink Engraved "V"',
    text: 'Under my desk: a silver cufflink engraved with a "V". Voss came for a business meeting at 4 pm.',
    likelihoods: [0.3, 0.3, 0.6, 0.3],
    reasons: [
      'Voss sat at this desk at 4 pm. He could have dropped it then, whoever the culprit was: 0.3.',
      'Same: lost during the afternoon meeting, 0.3.',
      'If Voss came back tonight, a dropped cufflink is more likely: 0.6.',
      'Same as for Graves: 0.3.',
    ],
    trap: "Prosecutor's fallacy",
    lesson:
      'P(cufflink | Voss guilty) = 0.6, but that is NOT P(Voss guilty | cufflink). ' +
      'On its own this clue is weak (likelihood ratio 2). What convicts Voss is ALL the evidence together: about 92%.',
    reaction: [
      'Voss\u2019s cufflink. But he sat at this desk this afternoon...',
      'On its own it proves little. Together with everything else, the picture is clear.',
    ],
    nextThought: 'I have seen enough. Time to return to my body and name the culprit.',
  },
];

export const EPILOGUE_CORRECT = [
  'Voss. My partner of twenty years.',
  'He was stealing from the business. I was about to discover it, so he came back through the garden while the house was quiet.',
  'The fingerprints, the letter and the mud were loud, but they were not strong evidence.',
  'The ledger, the alibis and the cufflink were quiet, and together they spoke clearly.',
  'The clocks slow down... and for the first time tonight, I can rest.',
];

export const EPILOGUE_WRONG = [
  'The accusation echoes through the empty house... and nothing happens.',
  'The clocks keep ticking. The case is not closed.',
  'Perhaps a loud clue drowned out the quiet ones?',
];
