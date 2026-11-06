import Phaser from 'phaser';
import { ACCENT, BarRow, Button, DIM, INK, W, hex, overlayBackground, stackedBar, txt } from '../ui/widgets';
import { CLUES, PRIOR_SHEET, SUSPECTS } from '../data/case1';
import { GameState, StepRecord, truePrior } from '../state/GameState';
import { joint, normalize, pct, scoreGuess, update } from '../bayes/engine';
import { drawSuspect } from './MemoryScene';
import { Sound } from '../audio/Sound';

type Kind = 'prior' | 'clue';

interface Step {
  /** Short name shown in the breadcrumb at the top. */
  crumb: string;
  build: () => void;
}

const GOLD = '#ffe9b8';
const CONTENT_Y = 128;
const NAV_Y = 668;

const HUNCHES = [
  { label: 'Unlikely', test: (l: number) => l < 0.35 },
  { label: 'Toss-up', test: (l: number) => l >= 0.35 && l < 0.7 },
  { label: 'Likely', test: (l: number) => l >= 0.7 },
];

/** Strip the trailing ", 0.3." number from a reason so Hard mode shows words only. */
function wordsOnly(reason: string): string {
  return reason.replace(/[:,]?\s*\d+(\.\d+)?\.$/, '.');
}

function num(x: number) {
  return x >= 0.995 ? '1' : x.toFixed(x < 0.1 ? 3 : 2).replace(/0+$/, '').replace(/\.$/, '');
}

/**
 * A note or clue, examined one idea at a time:
 *   context → one page per suspect → weigh (prior × likelihood) → balance (÷ P(E)) → lesson.
 * The household log follows the same rhythm: context → one page per suspect → the prior.
 */
export class EvidenceScene extends Phaser.Scene {
  private kind: Kind = 'clue';
  private steps: Step[] = [];
  private index = 0;
  private page!: Phaser.GameObjects.Container;
  private crumbs: Phaser.GameObjects.Text[] = [];
  private nextBtn!: Button;
  private backBtn!: Button;
  private closing = false;
  /** Once the update is applied to the board, earlier pages can no longer be revisited. */
  private committed = false;

  // working state for this examination
  private prior: number[] = [];
  private lik: number[] = [];
  private hunches: (number | undefined)[] = [];
  private guess: number[] = [];
  private guessLocked = false;
  private rec?: StepRecord;

  constructor() {
    super('Evidence');
  }

  init(data: { kind: Kind }) {
    this.kind = data.kind;
    this.index = 0;
    this.closing = false;
    this.committed = false;
    this.crumbs = [];
    this.hunches = [];
    this.guessLocked = false;
    this.rec = undefined;
  }

  create() {
    overlayBackground(this);
    txt(this, W - 40, 30, `${GameState.difficulty.toUpperCase()} MODE`, 15, DIM).setOrigin(1, 0);
    this.page = this.add.container();
    this.backBtn = new Button(this, 130, NAV_Y, '‹ Back', () => this.go(-1), { width: 180, height: 56, size: 22 });
    this.nextBtn = new Button(this, W - 150, NAV_Y, 'Next ›', () => this.go(1), { width: 240, height: 60, size: 24 });
    this.input.keyboard?.on('keydown-RIGHT', () => this.nextBtn.alpha === 1 && this.onNext());
    this.input.keyboard?.on('keydown-LEFT', () => this.backBtn.visible && this.go(-1));

    this.steps = this.kind === 'prior' ? this.priorSteps() : this.clueSteps();
    this.buildCrumbs();
    this.show();
    this.cameras.main.fadeIn(250);
  }

  // ================================================================== navigation

  private go(delta: number) {
    Sound.blip();
    if (delta > 0 && this.index === this.steps.length - 1) return this.close();
    this.index = Phaser.Math.Clamp(this.index + delta, 0, this.steps.length - 1);
    this.show();
  }

  private show() {
    this.page.removeAll(true);
    this.page.setAlpha(0);
    this.setNext('Next ›', true);
    this.steps[this.index].build();
    this.backBtn.setVisible(this.index > 0 && !this.committed);
    if (this.index === this.steps.length - 1 && this.nextBtn.label.text.startsWith('Next')) {
      this.setNext('Continue ›', this.nextBtn.alpha === 1);
    }
    this.crumbs.forEach((c, i) => {
      c.setColor(i === this.index ? GOLD : i < this.index ? '#9fb0d6' : '#4a5677');
      c.setFontStyle(i === this.index ? 'bold' : 'normal');
    });
    this.tweens.add({ targets: this.page, alpha: 1, duration: 250 });
  }

  private setNext(label: string, enabled: boolean, onClick?: () => void) {
    this.nextBtn.label.setText(label);
    this.nextBtn.setEnabled(enabled);
    this.nextOverride = onClick;
  }
  private nextOverride?: () => void;

  private buildCrumbs() {
    const labels = this.steps.map((s) => s.crumb);
    const sep = '  ›  ';
    // measure, then centre the whole trail
    const probe = txt(this, 0, 0, labels.join(sep), 16);
    let x = W / 2 - probe.width / 2;
    probe.destroy();
    labels.forEach((l, i) => {
      const t = txt(this, x, 82, l, 16, '#4a5677');
      this.crumbs.push(t);
      x += t.width;
      if (i < labels.length - 1) {
        const s = txt(this, x, 82, sep, 16, '#33405e');
        x += s.width;
      }
    });
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

  // ================================================================== page helpers

  private put<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.page.add(o);
    return o;
  }

  private title(s: string) {
    this.put(txt(this, W / 2, 26, s, 32, GOLD, { fontStyle: 'bold' }).setOrigin(0.5, 0));
  }

  private para(x: number, y: number, s: string, size = 24, color = INK, width = 1000, origin = 0) {
    return this.put(
      txt(this, x, y, s, size, color, { wordWrap: { width }, lineSpacing: 6, align: origin ? 'center' : 'left' }).setOrigin(origin, 0),
    );
  }

  /** "Where I stand": the current belief as a labelled stacked bar. */
  private beliefStrip(y: number, dist: number[], label: string) {
    this.put(txt(this, W / 2, y, label, 18, DIM).setOrigin(0.5, 0));
    this.put(stackedBar(this, W / 2 - 360, y + 44, 720, 26, dist, SUSPECTS.map((s) => s.color)));
    let x = W / 2 - 360;
    SUSPECTS.forEach((s, i) => {
      const t = txt(this, x, y + 66, `${s.name} ${pct(dist[i])}`, 18, hex(s.color));
      this.put(t);
      x += Math.max(t.width + 28, 720 * dist[i]);
    });
  }

  /** Silhouette and name on the left of a one-suspect page. */
  private suspectPortrait(i: number) {
    const s = SUSPECTS[i];
    this.put(drawSuspect(this, 225, 360, i, 0.72));
    this.put(txt(this, 225, 520, s.name, 30, hex(s.color), { fontStyle: 'bold' }).setOrigin(0.5, 0));
    this.put(txt(this, 225, 558, s.role, 19, DIM, { fontStyle: 'italic' }).setOrigin(0.5, 0));
  }

  // ================================================================== the household log (prior)

  private priorSteps(): Step[] {
    const d = GameState.difficulty;
    const truth = truePrior();
    const total = PRIOR_SHEET.total;
    const steps: Step[] = [
      {
        crumb: 'The log',
        build: () => {
          this.title(PRIOR_SHEET.title);
          this.para(W / 2, CONTENT_Y + 20, PRIOR_SHEET.text, 25, INK, 980, 0.5);
          this.para(W / 2, CONTENT_Y + 200, PRIOR_SHEET.context, 25, '#cfe6ff', 980, 0.5);
          this.para(W / 2, CONTENT_Y + 350, 'So where should my suspicion start? One person at a time.', 23, ACCENT, 980, 0.5);
        },
      },
    ];
    SUSPECTS.forEach((s, i) =>
      steps.push({
        crumb: s.name,
        build: () => {
          this.title(PRIOR_SHEET.title);
          this.suspectPortrait(i);
          this.para(470, CONTENT_Y + 30, `${s.name} was inside for ${s.hoursInside} hours.`, 30, hex(s.color), 760);
          this.para(470, CONTENT_Y + 90, `Everyone together: ${total} hours. Each block below is half an hour.`, 21, DIM, 760);
          this.hourBlocks(470, CONTENT_Y + 160, i);
          if (d === 'easy') {
            this.para(470, CONTENT_Y + 270, `${s.hoursInside} of ${total} hours → ${s.hoursInside} ÷ ${total} = ${pct(truth[i])}`, 28, INK, 760);
            this.para(470, CONTENT_Y + 330, `So before any clue, ${s.name} gets ${pct(truth[i])} of my suspicion.`, 22, '#cfe6ff', 760);
          } else {
            this.para(470, CONTENT_Y + 270, `${s.name}’s share: ${s.hoursInside} of ${total} hours.`, 28, INK, 760);
            this.para(470, CONTENT_Y + 330, 'Keep that share in mind: you will set the starting point yourself in a moment.', 22, '#cfe6ff', 760);
          }
        },
      }),
    );
    steps.push({
      crumb: 'Prior',
      build: () => {
        this.title('My starting point: the prior');
        if (d === 'easy') {
          this.para(W / 2, CONTENT_Y + 10, 'Each person’s share of the time inside becomes their starting suspicion.', 23, '#cfe6ff', 1000, 0.5);
          this.barsTable(truth.map(() => 0), truth, (i) => `${SUSPECTS[i].hoursInside} ÷ ${total}`, true);
          this.commitPrior(truth);
          return;
        }
        if (!this.guessLocked) {
          if (!this.guess.length) this.guess = SUSPECTS.map(() => 0.5);
          this.para(
            W / 2,
            CONTENT_Y + 10,
            d === 'medium'
              ? 'Drag the bars to where you think each starting suspicion should be. They always add up to 100%.'
              : 'Set YOUR prior by dragging the bars. In Hard mode the ghost uses exactly what you choose.',
            22,
            '#cfe6ff',
            1000,
            0.5,
          );
          const rows = this.dragTable(this.guess);
          this.setNext(d === 'medium' ? 'Lock in' : 'Commit prior', true);
          this.replaceNext(() => {
            this.guess = normalize(rows.map((r) => r.value));
            this.guessLocked = true;
            this.show();
          });
          return;
        }
        if (d === 'medium') {
          this.para(W / 2, CONTENT_Y + 10, `Your guess (white line) against the true prior. Score: ${scoreGuess(this.guess, truth)}/100.`, 23, '#9ff0b0', 1000, 0.5);
          this.barsTable(this.guess, truth, (i) => `${SUSPECTS[i].hoursInside} ÷ ${total}`, true, this.guess);
          this.commitPrior(truth);
        } else {
          this.para(W / 2, CONTENT_Y + 10, 'Your prior is set. Every clue from now on updates YOUR numbers.', 23, '#cfe6ff', 1000, 0.5);
          this.barsTable(this.guess, this.guess, () => 'your choice', false);
          this.commitPrior(this.guess);
        }
      },
    });
    if (d !== 'hard') {
      steps.push({
        crumb: 'Lesson',
        build: () => {
          this.title('What the prior means');
          this.para(W / 2, CONTENT_Y + 60, PRIOR_SHEET.lesson, 27, INK, 960, 0.5);
          this.para(W / 2, CONTENT_Y + 260, 'Every clue I find from now on will shift these numbers. How far each one shifts them is the whole art.', 23, '#cfe6ff', 960, 0.5);
        },
      });
    }
    return steps;
  }

  private commitPrior(p: number[]) {
    if (!this.committed) {
      GameState.setPrior(p);
      this.committed = true;
    }
  }

  /** Half-hour blocks: everyone's time inside, with this suspect's blocks lit. */
  private hourBlocks(x: number, y: number, focus: number) {
    const g = this.put(this.add.graphics());
    const cells = SUSPECTS.reduce((a, s) => a + s.hoursInside * 2, 0);
    const cw = Math.min(36, 740 / cells);
    let c = 0;
    SUSPECTS.forEach((s, i) => {
      for (let k = 0; k < s.hoursInside * 2; k++, c++) {
        g.fillStyle(s.color, i === focus ? 0.95 : 0.16);
        g.fillRoundedRect(x + c * cw, y, cw - 4, 46, 5);
      }
    });
  }

  // ================================================================== a clue

  private clueSteps(): Step[] {
    const d = GameState.difficulty;
    const clue = CLUES[GameState.data.found];
    this.prior = GameState.data.belief.slice();
    this.lik = d === 'hard' ? SUSPECTS.map(() => 0.5) : clue.likelihoods.slice();
    const n = GameState.data.found + 1;
    const head = `Clue ${n} of ${CLUES.length}: ${clue.title}`;

    const steps: Step[] = [
      {
        crumb: 'The clue',
        build: () => {
          this.title(head);
          this.para(W / 2, CONTENT_Y + 20, clue.text, 27, INK, 1000, 0.5);
          this.para(W / 2, CONTENT_Y + 140, clue.context, 24, '#cfe6ff', 980, 0.5);
          this.beliefStrip(CONTENT_Y + 300, this.prior, 'Where my suspicion stands before this clue (the prior):');
          this.para(
            W / 2,
            CONTENT_Y + 420,
            'The question is never "who does this point at?" but: if each person were guilty, how likely is it that I would find this?',
            21,
            ACCENT,
            1000,
            0.5,
          );
        },
      },
    ];
    SUSPECTS.forEach((_, i) => steps.push({ crumb: SUSPECTS[i].name, build: () => this.suspectPage(i, clue, head) }));
    steps.push({ crumb: 'Weigh', build: () => this.weighPage(head) });
    steps.push({ crumb: 'Balance', build: () => this.balancePage(head) });
    steps.push({ crumb: d === 'hard' ? 'Board' : 'Lesson', build: () => this.lessonPage(head) });
    return steps;
  }

  private suspectPage(i: number, clue: (typeof CLUES)[number], head: string) {
    const d = GameState.difficulty;
    const s = SUSPECTS[i];
    this.title(head);
    this.suspectPortrait(i);
    this.para(470, CONTENT_Y + 10, `Suppose ${s.name} did it.`, 32, hex(s.color), 760);
    this.para(470, CONTENT_Y + 62, `How likely would I be to find ${clue.short}?`, 25, INK, 760);
    this.para(470, CONTENT_Y + 104, `This is the likelihood: P(clue | ${s.name} did it).`, 18, DIM, 760);

    if (d === 'hard') {
      this.para(470, CONTENT_Y + 150, wordsOnly(clue.reasons[i]), 22, '#cfe6ff', 760);
      const row = this.put(
        new BarRow(this, 470, CONTENT_Y + 300, 520, s.color, this.lik[i], (v) => `P = ${v.toFixed(2)}`, {
          draggable: !this.committed,
          step: 0.05,
          min: 0.05,
          height: 30,
        }),
      );
      row.onChange = (v) => (this.lik[i] = +v.toFixed(2));
      this.para(470, CONTENT_Y + 350, 'Drag: near 0 = almost impossible if guilty, 1 = certain if guilty.', 18, DIM, 760);
      return;
    }

    // Easy / Medium: a gut call first, then the ghost's reading.
    const chosen = this.hunches[i];
    HUNCHES.forEach((h, k) => {
      const b = this.put(
        new Button(this, 560 + k * 235, CONTENT_Y + 185, h.label, () => {
          this.hunches[i] = k;
          this.show();
        }, { width: 215, height: 56, size: 22, stroke: chosen === k ? 0xffe2a0 : 0x5a6a90 }),
      );
      if (chosen !== undefined && chosen !== k) b.setAlpha(0.45);
    });
    if (chosen === undefined) {
      this.para(470, CONTENT_Y + 240, 'Go with your gut first.', 20, DIM, 760);
      this.setNext('Next ›', false);
      return;
    }
    const l = clue.likelihoods[i];
    const truthK = HUNCHES.findIndex((h) => h.test(l));
    this.put(new BarRow(this, 470, CONTENT_Y + 262, 520, s.color, 0, () => `P = ${num(l)}`, { height: 28 })).setValue(l, true);
    this.para(470, CONTENT_Y + 300, clue.reasons[i], 21, '#cfe6ff', 760);
    this.para(
      470,
      CONTENT_Y + 400,
      chosen === truthK ? 'Same instinct as the ghost.' : `The ghost reads this as "${HUNCHES[truthK].label}".`,
      21,
      chosen === truthK ? '#9ff0b0' : GOLD,
      760,
    );
  }

  /** prior × likelihood, one row at a time. */
  private weighPage(head: string) {
    const d = GameState.difficulty;
    this.title(head);
    this.para(
      W / 2,
      CONTENT_Y + 4,
      'Weigh each story: multiply how much I suspected each person BEFORE (the prior) by how well their guilt explains the clue (the likelihood).',
      22,
      '#cfe6ff',
      1060,
      0.5,
    );
    const j = joint(this.prior, this.lik);
    const max = Math.max(...j);
    const rowH = Math.min(84, 330 / SUSPECTS.length);
    SUSPECTS.forEach((s, i) => {
      const y = CONTENT_Y + 140 + i * rowH;
      const row = this.put(this.add.container(0, 0).setAlpha(0));
      row.add(txt(this, 70, y - 14, s.name, 25, hex(s.color), { fontStyle: 'bold' }));
      row.add(txt(this, 300, y - 14, `${pct(this.prior[i])}  ×  ${num(this.lik[i])}  =  ${j[i].toFixed(3)}`, 25, INK));
      const bar = new BarRow(this, 760, y, 360, s.color, 0, () => j[i].toFixed(3), { height: 24 });
      row.add(bar);
      this.time.delayedCall(350 + i * 650, () => {
        this.tweens.add({ targets: row, alpha: 1, duration: 300 });
        bar.setValue(j[i] / max, true);
      });
    });
    const ratioNote =
      d === 'hard'
        ? 'These are YOUR likelihoods.'
        : 'Notice: only the RATIOS between the likelihoods matter. A clue equally likely for everyone changes nothing.';
    this.para(W / 2, CONTENT_Y + 470, ratioNote, 19, DIM, 1060, 0.5);
  }

  /** ÷ P(E): turn the weights back into beliefs that add up to 100%. */
  private balancePage(head: string) {
    const d = GameState.difficulty;
    this.title(head);
    const j = joint(this.prior, this.lik);
    const pE = j.reduce((a, b) => a + b, 0);
    const post = update(this.prior, this.lik);

    if (d === 'medium' && !this.guessLocked) {
      this.para(
        W / 2,
        CONTENT_Y + 4,
        'The weights don’t add up to 100% yet. Before the ghost does the division: where do you think the bars will land? Drag them.',
        22,
        '#cfe6ff',
        1060,
        0.5,
      );
      if (!this.guess.length) this.guess = this.prior.slice();
      const rows = this.dragTable(this.guess, this.prior);
      this.setNext('Lock in', true);
      this.replaceNext(() => {
        this.guess = normalize(rows.map((r) => r.value));
        this.guessLocked = true;
        this.show();
      });
      return;
    }

    if (!this.committed) {
      this.rec = GameState.applyClue(d === 'hard' ? { playerLik: this.lik } : d === 'medium' ? { guess: this.guess } : {});
      this.committed = true;
    }
    this.para(
      W / 2,
      CONTENT_Y + 4,
      `Add the weights: ${j.map((x) => x.toFixed(3)).join(' + ')} = ${pE.toFixed(3)}. That total is P(clue). Divide each weight by it:`,
      22,
      '#cfe6ff',
      1060,
      0.5,
    );
    this.barsTable(
      this.prior,
      post,
      (i) => `${j[i].toFixed(3)} ÷ ${pE.toFixed(3)}`,
      true,
      d === 'medium' ? this.guess : undefined,
      true,
    );
    if (d === 'medium' && this.rec?.score !== undefined) {
      this.para(W / 2, CONTENT_Y + 470, `Your guess (white line) scored ${this.rec.score}/100.`, 22, '#9ff0b0', 1000, 0.5);
    } else if (d === 'easy') {
      this.para(W / 2, CONTENT_Y + 470, 'Faint bar = before this clue. Bright bar = after. That is one Bayesian update.', 19, DIM, 1000, 0.5);
    } else {
      this.para(W / 2, CONTENT_Y + 470, 'Your board now follows your own likelihoods.', 19, DIM, 1000, 0.5);
    }
  }

  private lessonPage(head: string) {
    const d = GameState.difficulty;
    const clue = CLUES[GameState.data.found - 1];
    this.title(head);
    const after = this.rec?.belief ?? GameState.data.belief;
    if (d === 'hard') {
      this.beliefStrip(CONTENT_Y + 40, after, 'Your board after this clue:');
      this.para(W / 2, CONTENT_Y + 230, 'The ghost keeps its own verdict to itself until you name the culprit.', 24, '#cfe6ff', 960, 0.5);
      return;
    }
    this.put(txt(this, W / 2, CONTENT_Y + 10, `Trap: ${clue.trap}`, 28, GOLD, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    this.para(W / 2, CONTENT_Y + 70, clue.lesson, 25, INK, 980, 0.5);
    this.beliefStrip(CONTENT_Y + 300, after, 'Where my suspicion stands now (the posterior, and the prior for the next clue):');
  }

  // ================================================================== shared tables

  /** Rows of before → after bars, revealed one at a time. */
  private barsTable(
    before: number[],
    after: number[],
    formula: (i: number) => string,
    animate: boolean,
    marker?: number[],
    showBefore = false,
  ) {
    const rowH = Math.min(86, 340 / SUSPECTS.length);
    SUSPECTS.forEach((s, i) => {
      const y = CONTENT_Y + 130 + i * rowH;
      const row = this.put(this.add.container(0, 0).setAlpha(animate ? 0 : 1));
      row.add(txt(this, 70, y - 14, s.name, 25, hex(s.color), { fontStyle: 'bold' }));
      row.add(txt(this, 280, y - 12, `${formula(i)}  =`, 22, DIM));
      if (showBefore) {
        row.add(this.add.rectangle(560, y, 440 * before[i], 26, s.color, 0.22).setOrigin(0, 0.5));
      }
      const bar = new BarRow(this, 560, y, 440, s.color, before[i], (v) => pct(v), { height: 26 });
      row.add(bar);
      if (marker) bar.showMarker(marker[i]);
      const go = () => {
        this.tweens.add({ targets: row, alpha: 1, duration: 300 });
        bar.setValue(after[i], true);
        bar.setLabel(showBefore ? `${pct(before[i])} → ${pct(after[i])}` : pct(after[i]));
      };
      if (animate) this.time.delayedCall(300 + i * 600, go);
      else go();
    });
  }

  /** Draggable guess bars; labels show the normalized share. Optional faint "before" bars. */
  private dragTable(initial: number[], before?: number[]): BarRow[] {
    const rowH = Math.min(86, 340 / SUSPECTS.length);
    const rows: BarRow[] = [];
    const refresh = () => {
      const n = normalize(rows.map((r) => r.value));
      rows.forEach((r, i) => r.setLabel(pct(n[i])));
    };
    SUSPECTS.forEach((s, i) => {
      const y = CONTENT_Y + 130 + i * rowH;
      this.put(txt(this, 70, y - 14, s.name, 25, hex(s.color), { fontStyle: 'bold' }));
      if (before) {
        this.put(txt(this, 280, y - 12, `before: ${pct(before[i])}`, 20, DIM));
        this.put(this.add.rectangle(480, y, 520 * before[i], 30, s.color, 0.2).setOrigin(0, 0.5));
      }
      const r = this.put(
        new BarRow(this, 480, y, 520, s.color, initial[i], () => '', { draggable: true, step: 0.01, min: 0.01, height: 30 }),
      );
      r.onChange = refresh;
      rows.push(r);
    });
    refresh();
    return rows;
  }

  /** Make the main button do something other than "next page" for this page only. */
  private replaceNext(fn: () => void) {
    this.nextOverride = fn;
  }

  /** The main button: a page-specific action if one is set, otherwise the next page. */
  private onNext() {
    if (this.nextOverride) {
      const f = this.nextOverride;
      this.nextOverride = undefined;
      f();
    } else this.go(1);
  }
}

