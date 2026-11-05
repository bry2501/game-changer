import Phaser from 'phaser';
import { ACCENT, BarRow, Button, DIM, W, hex, overlayBackground, txt } from '../ui/widgets';
import { CLUES, PRIOR_SHEET, SUSPECTS } from '../data/case1';
import { GameState, truePrior } from '../state/GameState';
import { evidenceProbability, joint, normalize, pct, scoreGuess } from '../bayes/engine';

type Kind = 'prior' | 'clue';

const ROW_Y = 215;
const ROW_H = 88;
const RIGHT_X = 650;
const BAR_W = 400;
const FOOT_Y = 575;

/** Strip the trailing ", 0.3." number from a reason so Hard mode shows words only. */
function wordsOnly(reason: string): string {
  return reason.replace(/[:,]?\s*\d+(\.\d+)?\.$/, '.');
}

export class EvidenceScene extends Phaser.Scene {
  private kind: Kind = 'clue';
  private rows: BarRow[] = [];
  private rowLabels: Phaser.GameObjects.Text[] = [];
  private foot!: Phaser.GameObjects.Text;
  private action?: Button;
  private closing = false;

  constructor() {
    super('Evidence');
  }

  init(data: { kind: Kind }) {
    this.kind = data.kind;
    this.rows = [];
    this.rowLabels = [];
    this.action = undefined;
    this.closing = false;
  }

  create() {
    overlayBackground(this);
    const d = GameState.difficulty;
    txt(this, W - 40, 30, `${d.toUpperCase()} MODE`, 16, DIM).setOrigin(1, 0);
    this.foot = txt(this, 50, FOOT_Y, '', 19, '#cfe6ff', { wordWrap: { width: 920 }, lineSpacing: 4 });

    if (this.kind === 'prior') this.buildPrior();
    else this.buildClue();

    this.cameras.main.fadeIn(250);
  }

  // ------------------------------------------------------------------ helpers

  private header(title: string, body: string, formula?: string) {
    txt(this, W / 2, 34, title, 34, '#ffe9b8', { fontStyle: 'bold' }).setOrigin(0.5, 0);
    txt(this, W / 2, 84, body, 21, '#dfe6ff', { align: 'center', wordWrap: { width: 1140 } }).setOrigin(0.5, 0);
    if (formula) txt(this, W / 2, 168, formula, 19, ACCENT).setOrigin(0.5, 0);
  }

  private suspectRow(i: number, sub: string) {
    const y = ROW_Y + i * ROW_H;
    const s = SUSPECTS[i];
    txt(this, 50, y - 14, `${s.name}, ${s.role}`, 23, hex(s.color), { fontStyle: 'bold' });
    txt(this, 50, y + 16, sub, 16, DIM, { wordWrap: { width: 570 } });
    return y;
  }

  private setAction(label: string, fn: () => void) {
    this.action?.destroy();
    this.action = new Button(this, W - 165, 668, label, fn, { width: 260, height: 62 });
  }

  private close() {
    if (this.closing) return;
    this.closing = true;
    this.cameras.main.fade(200, 0, 0, 0, true);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop();
      this.scene.resume('World', { from: 'evidence' });
    });
  }

  /** Guess bars (Medium / Hard prior): raw weights, labels show the normalized share. */
  private guessRows(initial: number[], labelPrefix: (i: number) => string) {
    const refresh = () => {
      const n = normalize(this.rows.map((r) => r.value));
      this.rows.forEach((r, i) => r.setLabel(pct(n[i])));
      this.rowLabels.forEach((l, i) => l.setText(labelPrefix(i)));
    };
    SUSPECTS.forEach((s, i) => {
      const y = ROW_Y + i * ROW_H;
      this.rowLabels.push(txt(this, RIGHT_X, y - 16, '', 17, DIM));
      const row = new BarRow(this, RIGHT_X, y + 22, BAR_W, s.color, initial[i], () => '', {
        draggable: true,
        step: 0.01,
        min: 0.01,
      });
      row.onChange = refresh;
      this.rows.push(row);
    });
    refresh();
  }

  // ------------------------------------------------------------------ prior

  private buildPrior() {
    const d = GameState.difficulty;
    const total = SUSPECTS.reduce((a, s) => a + s.hoursInside, 0);
    const prior = truePrior();
    this.header(PRIOR_SHEET.title, PRIOR_SHEET.text, 'Prior: P(H) = belief before any evidence');

    SUSPECTS.forEach((s, i) => this.suspectRow(i, `${s.hoursInside} hours inside the house tonight`));

    if (d === 'easy') {
      SUSPECTS.forEach((s, i) => {
        const y = ROW_Y + i * ROW_H;
        txt(this, RIGHT_X, y - 16, `${s.hoursInside} h ÷ ${total} h = ${pct(prior[i])}`, 19, '#dfe6ff');
        const row = new BarRow(this, RIGHT_X, y + 22, BAR_W, s.color, 0, (v) => pct(v));
        this.time.delayedCall(300 + i * 150, () => row.setValue(prior[i], true));
      });
      this.foot.setText(PRIOR_SHEET.lesson);
      this.setAction('Got it ▸', () => {
        GameState.setPrior(prior);
        this.close();
      });
      return;
    }

    this.foot.setText(
      d === 'medium'
        ? 'Drag the bars to set your prior. They are normalized so they add up to 100%. Then lock it in.'
        : 'Drag the bars to set YOUR prior. In Hard mode the ghost uses exactly what you choose.',
    );
    this.guessRows(SUSPECTS.map(() => 0.5), () => 'your prior');
    this.setAction(d === 'medium' ? 'Lock in' : 'Commit prior', () => {
      const guess = normalize(this.rows.map((r) => r.value));
      this.rows.forEach((r) => r.setDraggable(false));
      if (d === 'medium') {
        this.rows.forEach((r, i) => {
          r.setValue(guess[i], true);
          r.showMarker(prior[i]);
          r.setLabel(`you ${pct(guess[i])} · true ${pct(prior[i])}`);
        });
        this.foot.setText(`Score: ${scoreGuess(guess, prior)}/100. ${PRIOR_SHEET.lesson}`);
        this.setAction('Continue ▸', () => {
          GameState.setPrior(prior);
          this.close();
        });
      } else {
        GameState.setPrior(guess);
        this.foot.setText('Your prior is set. Now go and find evidence.');
        this.setAction('Continue ▸', () => this.close());
      }
    });
  }

  // ------------------------------------------------------------------ clue

  private buildClue() {
    const d = GameState.difficulty;
    const idx = GameState.data.found;
    const clue = CLUES[idx];
    const prior = GameState.data.belief.slice();
    this.header(
      `Clue ${idx + 1} of ${CLUES.length}: ${clue.title}`,
      clue.text,
      d === 'hard'
        ? 'For each suspect: how likely is this clue IF they are the culprit?  P(E | H)'
        : 'P(H | E)  =  P(E | H) · P(H)  /  P(E)',
    );
    SUSPECTS.forEach((_, i) => this.suspectRow(i, d === 'hard' ? wordsOnly(clue.reasons[i]) : clue.reasons[i]));

    if (d === 'easy') return this.clueEasy(prior);
    if (d === 'medium') return this.clueMedium(prior);
    return this.clueHard(prior);
  }

  private clueEasy(prior: number[]) {
    const clue = CLUES[GameState.data.found];
    const lik = clue.likelihoods;
    const j = joint(prior, lik);
    const pE = evidenceProbability(prior, lik);
    const rec = GameState.applyClue({});
    SUSPECTS.forEach((s, i) => {
      const y = ROW_Y + i * ROW_H;
      txt(this, RIGHT_X, y - 16, `${pct(prior[i])} × ${lik[i]} = ${j[i].toFixed(3)}  ÷ ${pE.toFixed(3)}`, 18, '#dfe6ff');
      const row = new BarRow(this, RIGHT_X, y + 22, BAR_W, s.color, prior[i], (v) => pct(v));
      this.time.delayedCall(600 + i * 120, () => row.setValue(rec.belief[i], true));
    });
    this.foot.setText(
      `P(E) = Σ P(E|H)·P(H) = ${pE.toFixed(3)}.   Trap: ${clue.trap}.\n${clue.lesson}`,
    );
    this.setAction('Continue ▸', () => this.close());
  }

  private clueMedium(prior: number[]) {
    const clue = CLUES[GameState.data.found];
    this.foot.setText(
      'Before: the bars show your current belief. Drag them to where you think they should be AFTER this clue, then lock in.',
    );
    this.guessRows(prior, (i) => `P(E|H) = ${clue.likelihoods[i]}   ·   before: ${pct(prior[i])}`);
    this.setAction('Lock in', () => {
      const rec = GameState.applyClue({ guess: this.rows.map((r) => r.value) });
      const guessN = rec.guess!;
      // Show the normalized guess as bars and mark the true posterior.
      this.rows.forEach((r, i) => {
        r.setDraggable(false);
        r.setValue(guessN[i], true);
        r.showMarker(rec.belief[i]);
        r.setLabel(`you ${pct(guessN[i])} · true ${pct(rec.belief[i])}`);
      });
      this.foot.setText(`Score: ${rec.score}/100 (white line = true posterior).   Trap: ${clue.trap}.\n${clue.lesson}`);
      this.setAction('Continue ▸', () => this.close());
    });
  }

  private clueHard(prior: number[]) {
    this.foot.setText(
      'Set each likelihood from 0 (impossible if guilty) to 1 (certain if guilty). Only the RATIOS between suspects matter.',
    );
    const sliders: BarRow[] = [];
    SUSPECTS.forEach((s, i) => {
      const y = ROW_Y + i * ROW_H;
      txt(this, RIGHT_X, y - 16, `your belief before: ${pct(prior[i])}`, 17, DIM);
      sliders.push(
        new BarRow(this, RIGHT_X, y + 22, BAR_W, s.color, 0.5, (v) => `P(E|H) = ${v.toFixed(2)}`, {
          draggable: true,
          step: 0.05,
          min: 0.05,
        }),
      );
    });
    this.setAction('Commit', () => {
      const lik = sliders.map((r) => +r.value.toFixed(2));
      const rec = GameState.applyClue({ playerLik: lik });
      sliders.forEach((r, i) => {
        r.setDraggable(false);
        r.setLabel(`${lik[i].toFixed(2)}  →  now ${pct(rec.belief[i])}`);
      });
      this.foot.setText('Your model has updated. The ghost will tell you how you did when you name the culprit.');
      this.setAction('Continue ▸', () => this.close());
    });
  }
}
