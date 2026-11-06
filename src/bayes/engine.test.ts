import { describe, expect, it } from 'vitest';
import { chain, likelihoodRatio, normalize, scoreGuess, update, argmax } from './engine';
import { CLUES, CULPRIT_INDEX, SUSPECTS, setCase } from '../data/case1';
import { truePrior } from '../state/GameState';

describe('engine', () => {
  it('normalizes', () => {
    expect(normalize([1, 1, 2])).toEqual([0.25, 0.25, 0.5]);
    expect(normalize([0, 0])).toEqual([0.5, 0.5]);
  });

  it('applies Bayes rule (classic disease test)', () => {
    // 1% prevalence, 90% sensitivity, 9% false positives -> ~9.2% posterior
    const post = update([0.01, 0.99], [0.9, 0.09]);
    expect(post[0]).toBeCloseTo(0.0917, 3);
  });

  it('likelihood ratio of non-diagnostic evidence is ~1', () => {
    expect(likelihoodRatio([0.25, 0.25, 0.25, 0.25], [0.9, 0.9, 0.9, 0.9], 0)).toBeCloseTo(1);
  });

  it('scores guesses', () => {
    expect(scoreGuess([1, 0], [1, 0])).toBe(100);
    expect(scoreGuess([0, 1], [1, 0])).toBe(0);
  });
});

describe('case 1 design (hard: 4 suspects)', () => {
  setCase('hard');
  const prior = truePrior();
  const steps = chain(prior, CLUES.map((c) => c.likelihoods));

  it('has the designed prior', () => {
    expect(prior.map((p) => +p.toFixed(2))).toEqual([0.35, 0.3, 0.2, 0.15]);
  });

  it('matches the designed posterior chain', () => {
    const expected = [
      [0.36, 0.29, 0.2, 0.15],
      [0.28, 0.45, 0.15, 0.11],
      [0.12, 0.19, 0.32, 0.38],
      [0.07, 0.11, 0.62, 0.21],
      [0.07, 0.01, 0.68, 0.23],
      [0.09, 0.01, 0.85, 0.04],
      [0.05, 0.01, 0.92, 0.02],
    ];
    expected.forEach((row, i) => {
      row.forEach((v, j) => expect(Math.abs(steps[i + 1][j] - v)).toBeLessThan(0.011));
    });
  });

  it('sets intuition traps: someone other than the culprit leads mid-case', () => {
    const leaders = steps.map(argmax);
    expect(leaders).toContain(1); // Clara after the letter
    expect(leaders).toContain(3); // Pip after the boot print
    expect(leaders[leaders.length - 1]).toBe(CULPRIT_INDEX);
  });

  it('every clue has a reason per suspect', () => {
    for (const c of CLUES) {
      expect(c.likelihoods).toHaveLength(SUSPECTS.length);
      expect(c.reasons).toHaveLength(SUSPECTS.length);
    }
  });
});

describe('story progression', () => {
  it('wakes with amnesia, then remembers, then reads the log, then gathers clues', async () => {
    const { GameState } = await import('../state/GameState');
    GameState.newGame('easy');
    expect(GameState.awakening).toBe(true);
    expect(GameState.nextTarget).toBe('body');
    GameState.rememberSuspects();
    expect(GameState.awakening).toBe(false);
    expect(GameState.nextTarget).toBe('prior');
    GameState.setPrior(truePrior());
    expect(GameState.nextTarget).toBe(0);
  });

  it('every clue has an inner-voice reaction', () => {
    setCase('hard');
    for (const c of CLUES) expect(c.reaction.length).toBeGreaterThan(0);
    for (const s of SUSPECTS) expect(s.memory.length).toBeGreaterThan(20);
  });
});

describe('suspects per difficulty', () => {
  const expectations = {
    easy: { n: 2, misleads: ['niece'] },
    medium: { n: 3, misleads: ['niece', 'gardener'] },
    hard: { n: 4, misleads: ['niece', 'gardener'] },
  } as const;
  for (const [d, e] of Object.entries(expectations)) {
    it(`${d}: ${e.n} suspects, intuition traps, and Voss wins in the end`, () => {
      setCase(d as 'easy' | 'medium' | 'hard');
      expect(SUSPECTS).toHaveLength(e.n);
      expect(SUSPECTS[CULPRIT_INDEX].id).toBe('partner');
      const steps = chain(truePrior(), CLUES.map((c) => c.likelihoods));
      const leaders = steps.slice(1).map((s) => SUSPECTS[argmax(s)].id);
      for (const m of e.misleads) expect(leaders).toContain(m);
      expect(steps[steps.length - 1][CULPRIT_INDEX]).toBeGreaterThan(0.9);
      // templates are resolved and thoughts chain correctly
      for (const c of CLUES) {
        expect(c.lesson).not.toMatch(/\{\w+\}/);
        expect(c.likelihoods).toHaveLength(e.n);
        expect(c.reasons).toHaveLength(e.n);
      }
      expect(CLUES[CLUES.length - 1].nextThought).toMatch(/name the culprit/);
    });
  }

  it('easy never mentions the absent suspects in its lessons', () => {
    setCase('easy');
    for (const c of CLUES) expect(c.lesson + c.trap + c.reaction.join(' ') + c.reasons.join(' ')).not.toMatch(/Pip|Graves|gardener/);
  });
});

describe('the house', () => {
  it('hides every clue of every mode in exactly one searchable place, among plenty of dead ends', async () => {
    const { SEARCHABLES, ROOMS, STAIRS_X } = await import('../data/house');
    for (const d of ['easy', 'medium', 'hard'] as const) {
      setCase(d);
      for (const c of CLUES) expect(SEARCHABLES.filter((s) => s.holds === c.id)).toHaveLength(1);
    }
    expect(SEARCHABLES.filter((s) => s.holds === 'prior')).toHaveLength(1);
    const deadEnds = SEARCHABLES.filter((s) => !s.holds && s.kind !== 'stairs');
    expect(deadEnds.length).toBeGreaterThanOrEqual(10);
    for (const s of deadEnds) expect(s.noise?.length).toBeGreaterThan(0);
    // something to search on both floors, and stairs that meet
    expect(new Set(SEARCHABLES.map((s) => s.floor))).toEqual(new Set([0, 1]));
    const stairs = SEARCHABLES.filter((s) => s.kind === 'stairs');
    expect(stairs.map((s) => s.floor).sort()).toEqual([0, 1]);
    for (const s of stairs) expect(s.x).toBe(STAIRS_X);
    // every searchable sits inside a room on its floor
    for (const s of SEARCHABLES) {
      expect(ROOMS.some((r) => r.floor === s.floor && s.x >= r.x0 && s.x < r.x1)).toBe(true);
    }
  });
});

describe('logic audit', () => {
  it('no likelihood claims certainty or impossibility', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      setCase(d);
      for (const c of CLUES) for (const l of c.likelihoods) {
        expect(l).toBeGreaterThan(0);
        expect(l).toBeLessThan(1);
      }
    }
  });

  it('the household log times match the hours that set the prior', () => {
    setCase('hard');
    const toHours = (t: string) => {
      const m = t.match(/(\d+):(\d+)\s*pm/)!;
      return (+m[1] % 12) + 12 + +m[2] / 60;
    };
    for (const s of SUSPECTS) {
      expect(s.backstory.length).toBeGreaterThan(80);
      expect(s.tonight.length).toBeGreaterThan(20);
      const inside = Math.min(toHours(s.logOut), 22) - Math.max(toHours(s.logIn), 18);
      expect(inside).toBeCloseTo(s.hoursInside, 5);
    }
  });

  it('every likelihood reason states the number it justifies', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      setCase(d);
      for (const c of CLUES) {
        c.reasons.forEach((r, i) => {
          const m = r.match(/(\d+(\.\d+)?)\.$/);
          if (m) expect(+m[1]).toBeCloseTo(c.likelihoods[i], 5);
        });
      }
    }
  });
});
