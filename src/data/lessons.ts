/**
 * The concept lessons: one new idea per clue, building as the case goes on.
 * They teach how to reason, never what to conclude about this clue.
 * Each has a plain core for everyone, plus a little more math in Levels 2 and 3.
 */
export interface Concept {
  title: string;
  /** The idea in plain words (all levels). {n} is the number of clues in the level, in words. */
  body: string;
  /** An extra sentence for Level 1 only, where just two suspects remain. */
  easyNote?: string;
  /** The same idea in numbers (Level 2) and in the language of the formula (Level 3). */
  numbers: string;
  formula: string;
}

export const CONCEPTS: Concept[] = [
  {
    title: 'Think in stories',
    body:
      'Don’t ask “who does this clue point at?” Instead, take one person at a time and imagine they did it. ' +
      'Then ask: in that story, how likely is it that I would find this clue? Each suspect is a story, and a clue fits some stories better than others. ' +
      'Judge each clue on its own, as if it were the only thing you had found; the board will do the combining.',
    numbers: 'How well a clue fits a story is called its likelihood. You rate it from 1 to 5; in the math a 1 counts as 10% and a 5 as 90%.',
    formula: 'The likelihood is written P(clue | person): the probability of finding this clue, given that this person did it.',
  },
  {
    title: 'Compare the fits',
    body:
      'What moves suspicion is not how well a clue fits one story, but how much BETTER it fits that story than the others. ' +
      'A clue that fits everyone’s story equally well changes nothing, however dramatic it looks.',
    numbers: 'If you give everyone the same rating, every share shrinks by the same fraction, and rescaling puts them right back where they were.',
    formula: 'Only the ratios between likelihoods matter: multiplying every P(clue | H) by the same number leaves every posterior unchanged.',
  },
  {
    title: 'Strong clues are lopsided',
    body:
      'A strong clue fits one story far better than the rest. Look for the lopsided ones: they move suspicion the most, even when they are quiet and undramatic. ' +
      'A clue that seems to scream a name can still be weak if it would turn up in other stories too.',
    numbers: 'Rated 5 against 1, one share keeps 90% while the other keeps 10%: nine times as much. Rated 4 against 3, it is barely more.',
    formula: 'The ratio P(clue | A) ÷ P(clue | B) is the strength of a clue. A ratio of 9 moves belief far more than a ratio of 1.4.',
  },
  {
    title: 'Clues can clear people',
    body:
      'If a clue fits someone’s story badly, their share shrinks, and what they lose is shared out among the other suspects still standing. ' +
      'An alibi is evidence too: it can push suspicion away from one person and onto the others.',
    easyNote: '(Here that is one person, because the log left only two names.)',
    numbers: 'A rating of 1 keeps only 10% of a share. After rescaling, everyone else grows to fill the space it leaves.',
    formula: 'A tiny P(clue | H) makes P(H | clue) tiny too, and dividing by P(clue) hands that probability to the other hypotheses.',
  },
  {
    title: 'Clues add up, and cancel out',
    body:
      'Each clue starts from where the last one left you: today’s board is tomorrow’s starting point. ' +
      'Clues build on each other, and a later clue can undo an earlier one. ' +
      'And because each clue simply multiplies what came before, the order does not matter: find the same {n} clues in any order and you end up in the same place.',
    numbers: 'Your shares after one clue become the starting shares for the next. The order you find clues in does not change where you end up.',
    formula: 'Today’s posterior is tomorrow’s prior: P(H | clue 1) becomes the P(H) you use for clue 2.',
  },
  {
    title: 'Don’t flip the question',
    body:
      '“How likely is this clue if Voss did it?” is a different question from “how likely is it that Voss did it?” ' +
      'A clue can fit someone’s story well and still be weak, if it would turn up anyway in the other stories.',
    numbers: 'A high rating for one person only helps them stand out if the others are rated lower. A 4 against 4s and 3s says very little.',
    formula: 'P(clue | Voss) is not P(Voss | clue). Confusing the two is called the prosecutor’s fallacy.',
  },
  {
    title: 'The whole chain',
    body:
      'No single clue decides a case. Your final suspicion is every clue, weighed one after another, starting from where you began. ' +
      'Loud clues and quiet clues all count, each by how lopsided it really is.',
    numbers: 'Every rating you have made has been multiplied in, one clue at a time, and rescaled each time.',
    formula: 'With independent clues, the posterior is the prior times every likelihood, rescaled once at the end: the order does not matter.',
  },
];

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export const numberWord = (n: number) => NUMBER_WORDS[n] ?? String(n);

/** A concept's plain-words body for a level with this many clues and suspects. */
export function conceptBody(c: Concept, clues: number, level: number): string {
  // the Level 1 note sits right after the sentence it explains
  let body = c.body.replace('{n}', numberWord(clues));
  if (level === 1 && c.easyNote) body = body.replace('still standing. ', `still standing. ${c.easyNote} `);
  return body;
}
