import Phaser from 'phaser';
import { ACCENT, BarRow, Button, DIM, INK, W, fadeThen, hex, overlayBackground, stackedBar, txt } from '../ui/widgets';
import { CLUES, Evidence, PRIOR_SHEET, SUSPECTS, allSuspects, fillLesson } from '../data/case1';
import { GameState, StepRecord, truePrior } from '../state/GameState';
import { joint, normalize, pct, scoreGuess, totalVariation, update } from '../bayes/engine';
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

/** The player's choices for a likelihood. Their numbers flow straight into the math. */
const STEPS = [
  { v: 0.05, label: 'Very unlikely' },
  { v: 0.2, label: 'Unlikely' },
  { v: 0.5, label: 'Toss-up' },
  { v: 0.7, label: 'Likely' },
  { v: 0.9, label: 'Very likely' },
];
const stepLabel = (v: number) => STEPS.find((s) => Math.abs(s.v - v) < 1e-9)?.label ?? 'the ghost\u2019s estimate';

/** "0.9 : 0.2 : 0.2" as "4.5 : 1 : 1" (relative to the smallest). */
function ratioText(lik: number[]): string {
  const m = Math.min(...lik);
  return lik.map((l) => +(l / m).toFixed(2)).join(' : ');
}

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
  /** The player's likelihood for each suspect (undefined until chosen). */
  private picks: (number | undefined)[] = [];
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
    this.picks = [];
    this.guess = [];
    this.guessLocked = false;
    this.rec = undefined;
  }

  create() {
    overlayBackground(this);
    txt(this, W - 40, 30, `${GameState.difficulty.toUpperCase()} MODE`, 15, DIM).setOrigin(1, 0);
    this.page = this.add.container();
    this.backBtn = new Button(this, 130, NAV_Y, '‹ Back', () => this.go(-1), { width: 180, height: 56, size: 22 });
    this.nextBtn = new Button(this, W - 150, NAV_Y, 'Next ›', () => this.onNext(), { width: 240, height: 60, size: 24 });
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
    // cancel the previous page's pending animations before its objects are destroyed
    this.time.removeAllEvents();
    this.tweens.killTweensOf(this.page.list);
    this.page.removeAll(true);
    this.page.setAlpha(0);
    this.setNext('Next ›', true);
    this.steps[this.index].build();
    this.backBtn.setVisible(this.index > 0 && !this.committed);
    if (this.index === this.steps.length - 1 && this.nextBtn.label.text.startsWith('Next')) {
      this.setNext('Continue ›', this.nextBtn.alpha === 1);
    }
    this.crumbs.forEach((c, i) => {
      // colour only: bold text is wider than the measured trail and would overlap the separators
      c.setColor(i === this.index ? GOLD : i < this.index ? '#9fb0d6' : '#4a5677');
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
    fadeThen(this, 200, () => {
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

  /**
   * The evidence itself, as found: a parchment card with dark ink, so it never
   * looks like the ghost's own thoughts. Returns the card's bottom y.
   */
  /**
   * The evidence itself, exactly as found: a parchment card with dark ink, so it never
   * looks like the ghost's thoughts. Letters read as letters, logs as tables, objects as
   * plain observations. Where it was found sits outside, as a caption. Returns the bottom y.
   */
  private evidenceCard(y: number, heading: string, doc: Evidence, found?: string): number {
    const w = 1010;
    const pad = 30;
    const x0 = W / 2 - w / 2;
    if (found) {
      this.put(txt(this, x0 + 4, y, `Found: ${found}`, 18, '#8f9ab8', { fontStyle: 'italic', wordWrap: { width: w } }));
      y += 34;
    }
    const card = this.put(this.add.container(0, 0));
    const bg = this.add.graphics();
    card.add(bg);
    card.add(txt(this, x0 + pad, y + 16, `EVIDENCE  \u00B7  ${heading.toUpperCase()}`, 15, '#8a6a44', { fontStyle: 'bold' }));
    let cy = y + 46;
    const ink = '#2a2118';
    const add = (t: Phaser.GameObjects.Text, gap = 6) => {
      card.add(t);
      cy += t.height + gap;
      return t;
    };
    if (doc.kind === 'letter') {
      add(txt(this, x0 + w - pad, cy, doc.date, 19, '#4a3a2a', { fontStyle: 'italic' }).setOrigin(1, 0), 2);
      doc.lines.forEach((l, k) =>
        add(txt(this, x0 + pad + (k ? 30 : 0), cy, l, k ? 27 : 23, ink, { fontStyle: 'italic', wordWrap: { width: w - pad * 2 - 30 } }), 8),
      );
      add(txt(this, x0 + w - pad - 40, cy, doc.sign, 25, ink, { fontStyle: 'italic' }).setOrigin(1, 0), 4);
    } else if (doc.kind === 'facts') {
      for (const [k, v] of doc.rows) {
        card.add(txt(this, x0 + pad, cy, k, 20, '#6b5236', { fontStyle: 'bold' }));
        add(txt(this, x0 + pad + 190, cy, v, 21, ink, { wordWrap: { width: w - pad * 2 - 190 } }), 6);
      }
    } else {
      // column positions from relative widths (equal unless the document says otherwise)
      const weights = doc.widths ?? doc.columns.map(() => 1);
      const total = weights.reduce((a, b) => a + b, 0);
      const colX: number[] = [];
      weights.reduce((acc, wt, k) => ((colX[k] = x0 + pad + ((w - pad * 2) * acc) / total), acc + wt), 0);
      doc.columns.forEach((c, k) => card.add(txt(this, colX[k], cy, c, 17, '#6b5236', { fontStyle: 'bold' })));
      cy += 26;
      bg.lineStyle(1, 0xb9a882, 1);
      bg.lineBetween(x0 + pad, cy - 4, x0 + w - pad, cy - 4);
      for (const r of doc.rows) {
        let h = 0;
        r.forEach((cell, k) => {
          const t = txt(this, colX[k], cy, cell, 20, ink);
          card.add(t);
          h = Math.max(h, t.height);
        });
        cy += h + 4;
      }
      if (doc.foot) add(txt(this, x0 + pad, cy + 4, doc.foot, 18, '#4a3a2a', { fontStyle: 'italic', wordWrap: { width: w - pad * 2 } }), 6);
    }
    const h = cy - y + pad - 12;
    bg.fillStyle(0x000000, 0.35);
    bg.fillRoundedRect(x0 + 6, y + 8, w, h, 6);
    bg.fillStyle(0xe9dfc7, 0.97);
    bg.fillRoundedRect(x0, y, w, h, 6);
    bg.fillStyle(0xd3c5a5, 1);
    bg.fillTriangle(x0 + w - 34, y, x0 + w, y, x0 + w, y + 34);
    bg.lineStyle(1, 0xb9a882, 1);
    bg.strokeRoundedRect(x0, y, w, h, 6);
    card.sendToBack(bg);
    return y + h;
  }

  /** The ghost's own reading of it: a small ghost and a pale-blue thought, set apart from the evidence. */
  private ghostNote(y: number, text: string): number {
    const w = 900;
    const x0 = W / 2 - w / 2 + 50;
    const note = this.put(this.add.container(0, 0));
    const bg = this.add.graphics();
    note.add(bg);
    const t = txt(this, x0 + 24, y + 16, text, 22, '#cfe6ff', { fontStyle: 'italic', wordWrap: { width: w - 48 }, lineSpacing: 5 });
    note.add(t);
    const h = t.height + 32;
    bg.fillStyle(0x0b1222, 0.9);
    bg.lineStyle(2, 0x9fd8ff, 0.45);
    bg.fillRoundedRect(x0, y, w, h, 18);
    bg.strokeRoundedRect(x0, y, w, h, 18);
    const glow = this.add.image(x0 - 52, y + h / 2, 'glow').setScale(0.9).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7);
    const ghost = this.add.image(x0 - 52, y + h / 2, 'ghost').setScale(0.42);
    note.add([glow, ghost]);
    bg.fillCircle(x0 - 14, y + h / 2 + 4, 6);
    bg.strokeCircle(x0 - 14, y + h / 2 + 4, 6);
    return y + h;
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
          const active = new Set(SUSPECTS.map((s) => s.id));
          const rows = allSuspects()
            .map((s) =>
              active.has(s.id)
                ? [s.name, s.logIn, s.logOut, `${s.hoursInside} h`]
                : [s.name, s.absentLog[0], s.absentLog[1], '\u2014'],
            );
          const bottom = this.evidenceCard(
            CONTENT_Y + 6,
            'the household log, tonight (6 \u2013 10 pm)',
            { kind: 'table', columns: ['Name', 'Signed in', 'Signed out', 'Inside'], rows, widths: [2, 2, 3.6, 1.2] },
            'on the side table in the study.',
          );
          this.ghostNote(bottom + 26, `${PRIOR_SHEET.text} ${PRIOR_SHEET.context}`);
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
    this.lik = [];
    const n = GameState.data.found + 1;
    const head = `Clue ${n} of ${CLUES.length}: ${clue.title}`;

    const steps: Step[] = [
      {
        crumb: 'The clue',
        build: () => {
          this.title(head);
          const bottom = this.evidenceCard(CONTENT_Y + 4, clue.title, clue.evidence, clue.found);
          this.ghostNote(bottom + 24, clue.context);
        },
      },
      {
        crumb: 'Before',
        build: () => {
          this.title(head);
          this.beliefStrip(CONTENT_Y + 30, this.prior, 'Before this clue, my suspicion stands here (the prior):');
          this.para(
            W / 2,
            CONTENT_Y + 200,
            'The question is never "who does this point at?"',
            26,
            INK,
            1000,
            0.5,
          );
          this.para(
            W / 2,
            CONTENT_Y + 250,
            'It is: if each person were guilty, how likely is it that I would find this? One suspect at a time.',
            24,
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
    if (d !== 'hard') steps.push({ crumb: 'Compare', build: () => this.comparePage(head, clue) });
    steps.push({ crumb: d === 'hard' ? 'Board' : 'Lesson', build: () => this.lessonPage(head) });
    return steps;
  }

  private suspectPage(i: number, clue: (typeof CLUES)[number], head: string) {
    const d = GameState.difficulty;
    const s = SUSPECTS[i];
    this.title(head);
    this.suspectPortrait(i);
    this.para(470, CONTENT_Y + 6, `Suppose ${s.name} did it.`, 31, hex(s.color), 760);
    this.para(470, CONTENT_Y + 54, `How likely would I be to find ${clue.short}?`, 24, INK, 760);
    this.para(470, CONTENT_Y + 92, `Your answer is the likelihood, P(clue | ${s.name} did it). You decide.`, 17, DIM, 760);

    // the ghost thinks out loud (no number), and the player chooses freely
    const hintBottom = this.ghostHint(470, CONTENT_Y + 124, wordsOnly(clue.reasons[i]));
    const chosen = this.picks[i];
    const by = hintBottom + 52;
    STEPS.forEach((st, k) => {
      const b = this.put(
        new Button(this, 470 + 74 + k * 154, by, `${st.label}\n${st.v}`, () => {
          if (this.committed) return;
          this.picks[i] = st.v;
          this.show();
        }, { width: 146, height: 70, size: 18, stroke: chosen === st.v ? 0xffe2a0 : 0x5a6a90 }),
      );
      b.label.setAlign('center').setLineSpacing(2);
      if (chosen !== undefined && chosen !== st.v) b.setAlpha(0.5);
    });
    if (chosen === undefined) {
      this.para(470, by + 50, 'There is no single right answer: pick what makes sense to you.', 18, DIM, 760);
      this.setNext('Next \u203A', false);
      return;
    }
    if (d !== 'easy') {
      this.para(470, by + 50, `Your likelihood: ${chosen} (${stepLabel(chosen)}).`, 20, '#9ff0b0', 760);
      return;
    }
    // Easy: the ghost offers its own estimate as a second opinion; the player may switch
    const g = clue.likelihoods[i];
    this.para(470, by + 50, `The ghost\u2019s estimate: ${num(g)}${STEPS.some((st) => st.v === g) ? ` (${stepLabel(g)})` : ''}. Your ${chosen} is ${chosen === g ? 'the same' : chosen > g ? 'higher' : 'lower'}.`, 20, '#cfe6ff', 760);
    if (Math.abs(chosen - g) > 1e-9) {
      const use = this.put(
        new Button(this, 470 + 150, by + 130, `Use the ghost\u2019s ${num(g)}`, () => {
          if (this.committed) return;
          this.picks[i] = g;
          this.show();
        }, { width: 280, height: 46, size: 18, stroke: 0x9fd8ff }),
      );
      void use;
      this.para(470 + 310, by + 118, `or keep your ${chosen}`, 18, DIM, 400);
    } else {
      this.para(470, by + 100, 'You and the ghost agree.', 18, '#9ff0b0', 760);
    }
  }

  /** A compact version of the ghost's note, for the right-hand column. */
  private ghostHint(x: number, y: number, text: string): number {
    const w = 760;
    const note = this.put(this.add.container(0, 0));
    const bg = this.add.graphics();
    note.add(bg);
    const t = txt(this, x + 56, y + 12, text, 19, '#cfe6ff', { fontStyle: 'italic', wordWrap: { width: w - 76 }, lineSpacing: 4 });
    note.add(t);
    const h = Math.max(t.height + 24, 56);
    bg.fillStyle(0x0b1222, 0.9);
    bg.lineStyle(2, 0x9fd8ff, 0.4);
    bg.fillRoundedRect(x, y, w, h, 14);
    bg.strokeRoundedRect(x, y, w, h, 14);
    note.add(this.add.image(x + 28, y + h / 2, 'ghost').setScale(0.3));
    return y + h;
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
    this.lik = this.picks.map((p) => p ?? 0.5);
    const j = joint(this.prior, this.lik);
    const max = Math.max(...j);
    const rowH = Math.min(84, 330 / SUSPECTS.length);
    SUSPECTS.forEach((s, i) => {
      const y = CONTENT_Y + 140 + i * rowH;
      const row = this.put(this.add.container(0, 0).setAlpha(0));
      row.add(txt(this, 70, y - 14, s.name, 25, hex(s.color), { fontStyle: 'bold' }));
      // show the prior as a decimal so the multiplication can be checked by hand
      const shown = +this.prior[i].toFixed(3) * this.lik[i];
      const eq = shown.toFixed(3) === j[i].toFixed(3) ? '=' : '\u2248';
      row.add(txt(this, 230, y - 14, `${this.prior[i].toFixed(3)}  ×  ${num(this.lik[i])}  ${eq}  ${j[i].toFixed(3)}`, 25, INK));
      row.add(txt(this, 230, y + 16, `prior  \u00D7  your likelihood (${stepLabel(this.lik[i])})`, 15, DIM));
      const bar = new BarRow(this, 760, y, 360, s.color, 0, () => j[i].toFixed(3), { height: 24 });
      row.add(bar);
      this.time.delayedCall(350 + i * 650, () => {
        this.tweens.add({ targets: row, alpha: 1, duration: 300 });
        bar.setValue(j[i] / max, true);
      });
    });
    void d;
    const ratioNote =
      `Only the RATIOS between your likelihoods matter: ${this.lik.map(num).join(' : ')} = ${ratioText(this.lik)}. ` +
      'If every likelihood were the same, the clue would change nothing.';
    this.para(W / 2, CONTENT_Y + 450, ratioNote, 19, DIM, 1060, 0.5);
    this.para(
      W / 2,
      CONTENT_Y + 490,
      'Weighing clues one at a time like this assumes each clue depends only on who did it, not on the other clues.',
      16,
      '#56627f',
      1060,
      0.5,
    );
  }

  /** ÷ P(E): turn the weights back into beliefs that add up to 100%. */
  private balancePage(head: string) {
    const d = GameState.difficulty;
    this.title(head);
    this.lik = this.picks.map((p) => p ?? 0.5);
    const j = joint(this.prior, this.lik);
    const pE = j.reduce((a, b) => a + b, 0);
    // the rounded weights may not add up exactly to the rounded total: say so honestly
    const sumEq = j.reduce((a, x) => a + +x.toFixed(3), 0).toFixed(3) === pE.toFixed(3) ? '=' : '\u2248';
    const post = update(this.prior, this.lik);

    if (d === 'medium' && !this.guessLocked) {
      this.para(
        W / 2,
        CONTENT_Y + 4,
        'The weights don’t add up to 100% yet. Before doing the division: where do you think the bars will land with YOUR likelihoods? Drag them.',
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
      this.rec = GameState.applyClue({ playerLik: this.lik, guess: d === 'medium' ? this.guess : undefined });
      this.committed = true;
    }
    this.para(
      W / 2,
      CONTENT_Y + 4,
      `P(clue) = the weights added up: ${j.map((x) => x.toFixed(3)).join(' + ')} ${sumEq} ${pE.toFixed(3)}. ` +
        'Each share is then multiplied by (its likelihood \u00F7 P(clue)):',
      22,
      '#cfe6ff',
      1060,
      0.5,
    );
    this.barsTable(
      this.prior,
      post,
      (i) => `${pct(this.prior[i])} \u00D7 (${num(this.lik[i])} \u00F7 ${pE.toFixed(3)} = \u00D7${(this.lik[i] / pE).toFixed(2)})`,
      true,
      d === 'medium' ? this.guess : undefined,
      true,
    );
    if (d === 'medium' && this.rec?.score !== undefined) {
      this.para(W / 2, CONTENT_Y + 470, `Your guess (white line) scored ${this.rec.score}/100.`, 22, '#9ff0b0', 1000, 0.5);
    } else {
      this.para(
        W / 2,
        CONTENT_Y + 462,
        'A likelihood above P(clue) makes that share grow; below it, the share shrinks. Faint bar = before, bright bar = after.',
        18,
        DIM,
        1040,
        0.5,
      );
    }
  }

  /** Your likelihoods vs the ghost's, both applied to the same prior, so the effect of the difference is visible. */
  private comparePage(head: string, clue: (typeof CLUES)[number]) {
    this.title(head);
    const yours = this.rec?.belief ?? update(this.prior, this.lik);
    const ghost = update(this.prior, clue.likelihoods);
    this.para(W / 2, CONTENT_Y + 2, 'Same starting point, two sets of likelihoods: yours and the ghost\u2019s.', 22, '#cfe6ff', 1040, 0.5);
    const cols = [70, 300, 520, 760, 1000];
    ['', 'your likelihood', 'ghost\u2019s', 'your result', 'ghost\u2019s result'].forEach((h, k) =>
      this.put(txt(this, cols[k], CONTENT_Y + 56, h, 17, DIM)),
    );
    const rowH = Math.min(62, 240 / SUSPECTS.length);
    SUSPECTS.forEach((s, i) => {
      const y = CONTENT_Y + 92 + i * rowH;
      const same = Math.abs(this.lik[i] - clue.likelihoods[i]) < 1e-9;
      this.put(txt(this, cols[0], y, s.name, 23, hex(s.color), { fontStyle: 'bold' }));
      this.put(txt(this, cols[1], y, `${num(this.lik[i])}`, 23, INK));
      this.put(txt(this, cols[2], y, `${num(clue.likelihoods[i])}`, 23, same ? INK : GOLD));
      this.put(txt(this, cols[3], y, pct(yours[i]), 23, INK));
      this.put(txt(this, cols[4], y, pct(ghost[i]), 23, INK));
    });
    const ry = CONTENT_Y + 100 + SUSPECTS.length * rowH;
    this.para(
      W / 2,
      ry,
      `Only the ratios matter. Yours: ${ratioText(this.lik)}.  The ghost\u2019s: ${ratioText(clue.likelihoods)}.`,
      22,
      INK,
      1060,
      0.5,
    );
    const gap = totalVariation(yours, ghost);
    const verdict =
      gap < 0.05
        ? 'Near enough the same ratios, so near enough the same conclusion.'
        : `Different ratios, different board: the ghost would now have ${SUSPECTS[ghost.indexOf(Math.max(...ghost))].name} on top at ${pct(Math.max(...ghost))}. Your board keeps YOUR numbers.`;
    this.para(W / 2, ry + 50, verdict, 21, gap < 0.05 ? '#9ff0b0' : GOLD, 1040, 0.5);
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
    // the lesson's numbers use the ghost's likelihoods applied to the same prior as yours
    this.para(W / 2, CONTENT_Y + 70, fillLesson(clue.lessonTemplate, update(this.prior, clue.likelihoods)), 24, INK, 980, 0.5);
    this.beliefStrip(CONTENT_Y + 300, after, 'Your board now (the posterior, and the prior for the next clue):');
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

