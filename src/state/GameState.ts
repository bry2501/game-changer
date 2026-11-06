import { CLUES, SUSPECTS } from '../data/case1';
import { AWAKEN_X } from '../data/house';
import { chain, Dist, normalize, update } from '../bayes/engine';

export interface StepRecord {
  clueId: string;
  /** Player's belief after this step (what the board shows). */
  belief: Dist;
  /** The likelihoods the player chose (they drive the board). */
  playerLik?: number[];
}

export interface SaveData {
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

const KEY = 'ghost-mystery-save-v4';

export function truePrior(): Dist {
  return normalize(SUSPECTS.map((s) => s.hoursInside));
}

/** The correct chain: index 0 is the prior, index k is the posterior after k clues. */
export function trueChain(): Dist[] {
  return chain(truePrior(), CLUES.map((c) => c.likelihoods));
}

class GameStateImpl {
  data: SaveData = GameStateImpl.fresh();

  static fresh(): SaveData {
    const uniform = SUSPECTS.map(() => 1 / SUSPECTS.length);
    return { found: -2, prior: uniform, belief: uniform, history: [], ghostX: AWAKEN_X, floor: 0, searched: [] };
  }

  newGame() {
    this.data = GameStateImpl.fresh();
    this.save();
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

  /** Apply the clue at index `this.data.found` with the player's own ratings. */
  applyClue(opts: { playerLik?: number[] }): StepRecord {
    const i = this.data.found;
    const clue = CLUES[i];
    // the player's own likelihoods drive their board; the intended ones are only a model answer
    const lik = opts.playerLik ?? clue.likelihoods;
    const belief = update(this.data.belief, lik);
    const rec: StepRecord = { clueId: clue.id, belief, playerLik: lik.slice() };
    this.data.belief = rec.belief;
    this.data.history.push(rec);
    this.data.found = i + 1;
    this.save();
    return rec;
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
