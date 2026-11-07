import { describe, expect, it } from 'vitest';
import { chain, likelihoodRatio, normalize, scoreGuess, update, argmax } from './engine';
import { CLUES, CULPRIT_INDEX, LOG_ROWS, SUSPECTS } from '../data/case1';
import { CONCEPTS } from '../data/lessons';
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

describe('the case', () => {
  const prior = truePrior();
  const steps = chain(prior, CLUES.map((c) => c.likelihoods));

  it('has two suspects, seven clues, and Thomas as the culprit', () => {
    expect(SUSPECTS.map((s) => s.name)).toEqual(['Clara', 'Mr. Thomas']);
    expect(CLUES.map((c) => c.id)).toEqual(['letter', 'will', 'boot', 'foxgloves', 'slip', 'phone', 'knife']);
    expect(SUSPECTS[CULPRIT_INDEX].id).toBe('gardener');
  });

  it('starts from opportunity: 3 hours against 2', () => {
    expect(prior.map((p) => +p.toFixed(2))).toEqual([0.6, 0.4]);
  });

  it('the intended ratings give the designed arc', () => {
    const R = [0.1, 0.3, 0.5, 0.7, 0.9];
    const intended = [[4, 3], [5, 5], [1, 3], [2, 5], [4, 2], [1, 3], [3, 4]].map((r) => r.map((k) => R[k - 1]));
    expect(CLUES.map((c) => c.likelihoods)).toEqual(intended);
    // Clara leads, the will changes nothing, Thomas pulls ahead, the slip brings Clara back, the alibi clears her
    expect(steps.map((p) => Math.round(p[0] * 100))).toEqual([60, 68, 68, 30, 12, 25, 6, 4]);
    expect(argmax(steps[1])).toBe(0);
    expect(steps[steps.length - 1][CULPRIT_INDEX]).toBeGreaterThan(0.9);
  });

  it('ends in the same place for every order of the clues', () => {
    const liks = CLUES.map((c) => c.likelihoods);
    const perms = (xs: number[][]): number[][][] => (xs.length < 2 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])));
    const all = perms(liks);
    expect(all).toHaveLength(5040);
    const end = steps[steps.length - 1][0];
    for (const o of all) expect(chain(prior, o)[7][0]).toBeCloseTo(end, 10);
  });

  it('every clue has hints, a reaction, a lesson and a concept', () => {
    expect(CONCEPTS).toHaveLength(CLUES.length);
    for (const c of CLUES) {
      expect(c.hints).toHaveLength(SUSPECTS.length);
      expect(c.reaction.length).toBeGreaterThan(0);
      expect(c.context.length).toBeGreaterThan(0);
      expect(c.lesson.length).toBeGreaterThan(40);
      for (const l of c.likelihoods) {
        expect(l).toBeGreaterThan(0);
        expect(l).toBeLessThan(1);
      }
    }
    expect(CLUES[CLUES.length - 1].nextThought).toMatch(/name the culprit/);
  });

  it('the household log matches the hours that set the prior', () => {
    const toHours = (t: string) => {
      const m = t.match(/(\d+):(\d+)\s*pm/)!;
      return (+m[1] % 12) + 12 + +m[2] / 60;
    };
    for (const s of SUSPECTS) {
      const inside = Math.min(toHours(s.logOut), 22) - Math.max(toHours(s.logIn), 18);
      expect(inside).toBeCloseTo(s.hoursInside, 5);
      expect(LOG_ROWS.some((r) => r[0] === s.name && r[1] === s.logIn && r[2] === s.logOut)).toBe(true);
    }
  });
});

describe('story progression', () => {
  it('wakes with amnesia, then remembers, then reads the log, then gathers clues', async () => {
    const { GameState } = await import('../state/GameState');
    GameState.newGame();
    expect(GameState.awakening).toBe(true);
    expect(GameState.nextTarget).toBe('body');
    GameState.rememberSuspects();
    expect(GameState.awakening).toBe(false);
    expect(GameState.nextTarget).toBe('prior');
    GameState.setPrior(truePrior());
    expect(GameState.nextTarget).toBe(0);
  });

  it("updates with the player's own ratings", async () => {
    const { GameState } = await import('../state/GameState');
    GameState.newGame();
    GameState.rememberSuspects();
    GameState.setPrior(truePrior());
    const mine = [0.9, 0.1];
    const rec = GameState.applyClue({ playerLik: mine });
    const expected = update(truePrior(), mine);
    rec.belief.forEach((b, i) => expect(b).toBeCloseTo(expected[i], 10));
    expect(rec.playerLik).toEqual(mine);
  });
});

describe('the house', () => {
  it('hides every clue in exactly one searchable place, among plenty of dead ends', async () => {
    const { SEARCHABLES, ROOMS, STAIRS_X } = await import('../data/house');
    for (const c of CLUES) expect(SEARCHABLES.filter((s) => s.holds === c.id)).toHaveLength(1);
    expect(SEARCHABLES.filter((s) => s.holds === 'prior')).toHaveLength(1);
    for (const s of SEARCHABLES) if (s.holds && s.holds !== 'prior') expect(CLUES.some((c) => c.id === s.holds)).toBe(true);
    const deadEnds = SEARCHABLES.filter((s) => !s.holds && s.kind !== 'stairs');
    expect(deadEnds.length).toBeGreaterThanOrEqual(10);
    for (const s of deadEnds) expect(s.noise?.length).toBeGreaterThan(0);
    expect(new Set(SEARCHABLES.map((s) => s.floor))).toEqual(new Set([0, 1]));
    const stairs = SEARCHABLES.filter((s) => s.kind === 'stairs');
    expect(stairs.map((s) => s.floor).sort()).toEqual([0, 1]);
    for (const s of stairs) expect(s.x).toBe(STAIRS_X);
    for (const s of SEARCHABLES) expect(ROOMS.some((r) => r.floor === s.floor && s.x >= r.x0 && s.x < r.x1)).toBe(true);
  });
});
