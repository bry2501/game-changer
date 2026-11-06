import { CLUES, Difficulty, SUSPECTS, setCase } from '../data/case1';
import { AWAKEN_X } from '../data/house';
import { chain, Dist, normalize, scoreGuess, update } from '../bayes/engine';

export type { Difficulty };

export interface StepRecord {
  clueId: string;
  /** Player's belief after this step (what the board shows). */
  belief: Dist;
  /** Medium: the player's raw guess (normalized). */
  guess?: Dist;
  /** Medium: 0–100 score for the guess. */
  score?: number;
  /** The likelihoods the player chose (they drive the board in every mode). */
  playerLik?: number[];
}

export interface SaveData {
  difficulty: Difficulty;
  /** -2 = just awoke (body not yet found), -1 = prior not yet set; otherwise clues collected (0..CLUES.length). */
  found: number;
  prior: Dist;
  belief: Dist;
  history: StepRecord[];
  ghostX: number;
  /** 0 = ground floor, 1 = upstairs. */
  floor: number;
  /** Ids of searchables already searched. */
  searched: string[];
}

const KEY = 'ghost-mystery-save-v3';

export function truePrior(): Dist {
  return normalize(SUSPECTS.map((s) => s.hoursInside));
}

/** The correct chain: index 0 is the prior, index k is the posterior after k clues. */
export function trueChain(): Dist[] {
  return chain(truePrior(), CLUES.map((c) => c.likelihoods));
}

class GameStateImpl {
  data: SaveData = GameStateImpl.fresh('easy');

  static fresh(difficulty: Difficulty): SaveData {
    setCase(difficulty);
    const uniform = SUSPECTS.map(() => 1 / SUSPECTS.length);
    return { difficulty, found: -2, prior: uniform, belief: uniform, history: [], ghostX: AWAKEN_X, floor: 0, searched: [] };
  }

  newGame(difficulty: Difficulty) {
    this.data = GameStateImpl.fresh(difficulty);
    this.save();
  }

  get difficulty() {
    return this.data.difficulty;
  }

  get priorSet() {
    return this.data.found >= 0;
  }

  get allFound() {
    return this.data.found >= CLUES.length;
  }

  /** True until the ghost has found its body and remembered the suspects. */
  get awakening() {
    return this.data.found < -1;
  }

  /** The next thing to pick up: the body, 'prior', a clue index, or 'accuse'. */
  get nextTarget(): 'body' | 'prior' | number | 'accuse' {
    if (this.data.found < -1) return 'body';
    if (this.data.found < 0) return 'prior';
    if (this.data.found < CLUES.length) return this.data.found;
    return 'accuse';
  }

  /** The body has been found and the suspects remembered. */
  rememberSuspects() {
    if (this.data.found < -1) this.data.found = -1;
    this.save();
  }

  setPrior(prior: Dist) {
    this.data.prior = normalize(prior);
    this.data.belief = this.data.prior.slice();
    this.data.found = 0;
    this.save();
  }

  /** Apply the clue at index `this.data.found` according to difficulty. */
  applyClue(opts: { guess?: number[]; playerLik?: number[] }): StepRecord {
    const i = this.data.found;
    const clue = CLUES[i];
    // the player's own likelihoods drive their board in every mode; the ghost's are for comparison
    const lik = opts.playerLik ?? clue.likelihoods;
    const belief = update(this.data.belief, lik);
    const rec: StepRecord = { clueId: clue.id, belief, playerLik: lik.slice() };
    if (opts.guess) {
      // Medium: how close was the guessed posterior to what the player's own numbers give?
      rec.guess = normalize(opts.guess);
      rec.score = scoreGuess(rec.guess, belief);
    }
    this.data.belief = rec.belief;
    this.data.history.push(rec);
    this.data.found = i + 1;
    this.save();
    return rec;
  }

  averageScore(): number | undefined {
    const scores = this.data.history.map((h) => h.score).filter((s): s is number => s !== undefined);
    if (!scores.length) return undefined;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* storage unavailable */
    }
  }

  hasSave(): boolean {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const d = JSON.parse(raw) as SaveData;
      return d.found >= 0;
    } catch {
      return false;
    }
  }

  load(): boolean {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      this.data = JSON.parse(raw) as SaveData;
      setCase(this.data.difficulty);
      return true;
    } catch {
      return false;
    }
  }

  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
}

export const GameState = new GameStateImpl();
