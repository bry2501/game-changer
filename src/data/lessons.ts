/**
 * The concept lessons: one new idea per clue, building as the case goes on.
 * They teach how to reason, never what to conclude about this clue.
 */
export interface Concept {
  title: string;
  /** The idea in plain words. */
  body: string;
}

export const CONCEPTS: Concept[] = [
  {
    title: 'Think in stories',
    body:
      'Don’t ask “who does this evidence point to?” Instead, go one person at a time and imagine they are the murderer. ' +
      'Then ask: assuming they are the murderer, how likely is it that I would find this evidence? ' +
      'Imagine a hundred different possible worlds in which that person is the murderer: on how many of them would this clue turn up? ' +
      'Each suspect is a story, and a clue fits some stories better than others.',
  },
  {
    title: 'Don’t count the same thing twice',
    body:
      'A clue can feel new and still be old news. You already knew about the will and who it would hurt, and the letter already carried it. ' +
      'If a clue would turn up just as readily in either story, it tells you nothing new. Counting the same thing twice makes a few clues look like a mountain.',
  },
  {
    title: 'Compare the fits',
    body:
      'What moves suspicion is not how well a clue fits one story, but how much BETTER it fits that story than the others. ' +
      'A clue that fits everyone’s story equally well changes nothing, however dramatic it looks.',
  },
  {
    title: 'Strong clues are lopsided',
    body:
      'A strong clue fits one story far better than the rest. Look for the lopsided ones: they move suspicion the most, even when they are quiet and undramatic. ' +
      'A clue that seems to scream a name can still be weak if it would turn up in other stories too.',
  },
  {
    title: 'Weigh what cuts against your favourite',
    body:
      'Once you lean one way, the clues that point the other way are the ones you will want to wave off. They count exactly as much as the ones you like. ' +
      'Give each the same honest rating, and let the board move, even when it moves toward the person you had stopped suspecting.',
  },
  {
    title: 'Clues can clear people',
    body:
      'If a clue fits someone’s story badly, their share shrinks, and what they lose is shared out among the other suspects still standing. ' +
      '(Here that is one person, because the log left only two names.) An alibi is evidence too: it can push suspicion away from one person and onto the others.',
  },
  {
    title: 'Clues add up, and cancel out',
    body:
      'Each clue starts from where the last one left you: today’s board is tomorrow’s starting point. Clues build on each other, and a later clue can undo an earlier one. ' +
      'And because each clue simply multiplies what came before, the order does not matter: find the same seven clues in any order and you end up in the same place.',
  },
];

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export const numberWord = (n: number) => NUMBER_WORDS[n] ?? String(n);
